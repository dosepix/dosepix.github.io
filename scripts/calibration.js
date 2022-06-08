var upload_measurement = document.getElementById('upload-measurement');
var upload_measurement_button = document.getElementById('upload-measurement-button');
var calib_download_button = document.getElementById('calib-download-button');
var slot_select_modal = document.getElementById('slot-select-modal');

// Calibration neural network model
var model = undefined;

function before_print_handler () {
    /**
     * Called after page is loaded. Hides results
     * and loads the model file
     */
    document.getElementById('calib-results').style.visibility = 'hidden';
    document.getElementById('calib-results-body').style.visibility = 'hidden';
}

// === Loaders ===
async function load_model(file) {
    /**
     * Loads the neural network model
     * 
     * @param {string} file The location of the model.json file
     * @returns {model}
     */
    try {
        const model = await tf.loadLayersModel(file);
        return model;
    } catch(err) {
        return undefined;
    }
}

async function load_meas_file(file) {
    /**
     * Loads measurement from file
     * 
     * @param {string} file The .json file containining the calibration measurement
     * @returns {Promise} The parsed .json file
     */
    var fr = new FileReader();

    return new Promise((resolve, reject) => {
        fr.onerror = () => {
          fr.abort();
          reject(new DOMException("Problem parsing input file."));
        };
    
        fr.onload = () => {
          resolve(JSON.parse(fr.result));
        };
        fr.readAsText(file);
    });
}

// === ToT and Energy math ===
function ToT_to_energy(x, a, b, c, t) {
    /**
     * Converts ToT to energy
     */
    return 1./(2*a) * ( t*a + x - b + Math.sqrt((b + t*a - x)**2 - 4*a*c) );
}

function get_THL(a, b, c, t) {
    /**
     * Get energy threshold from calibration parameters
     */
    let sqrt_sum = (b + t*a)*(b + t*a) - 4*a*c;
    if (sqrt_sum < 0) return 12;
    return 1. / (2*a) * (t*a - b + Math.sqrt( sqrt_sum ));
}

// === Prediction / Calibration ===
async function predict_meas(file) {
    /**
     * Predict calibration parameters from measurement file.
     * Throws alerts if model could not be loaded or file has the wrong format.
     * If file contains information for more than one slot, a selection model
     * is shown. If the data is correct, start_calibration() is called
     * 
     * @param {string} file The file containing the calibration measurement
     */
    if (model == undefined) {
        alert("Could not load neural network!");
        return;
    }

    // Check if file has the correct format
    let meas_file = file;
    if (meas_file.type != "application/json") {
        alert("File must be in .json-format!");
        return;
    }

    // Load file
    let meas = await load_meas_file(meas_file);

    // Check structure of object
    if (
        !meas.hasOwnProperty('frames') &&
        !meas.hasOwnProperty('Slot1') &&
        !meas.hasOwnProperty('Slot2') &&
        !meas.hasOwnProperty('Slot3')
    ) {
        alert("Provided file has wrong format!");
        return;
    }

    if (meas.hasOwnProperty('frames')) {
        start_calibration(meas, 'frames');
    } else {
        slot_select_modal.classList.add('is-active');
        var properties = [];
        for (const property in meas) {
            properties.push( property );
        }

        if (properties.length == 1) {
            start_calibration(meas, properties[0]);
        } else {
            var select_list = document.createElement("select");
            select_list.id = "slot-select";
            document.getElementById('slot-select-modal-body').innerHTML = "";
            document.getElementById('slot-select-modal-body').appendChild(select_list);

            //Create and append the options
            for (var idx = 0; idx < properties.length; idx++) {
                var option = document.createElement("option");
                option.value = properties[idx];
                option.text = properties[idx];
                select_list.appendChild(option);
            }
        }

        const slot_select_onclick = () => {
            slot_select_modal.classList.remove('is-active');
            start_calibration(meas, select_list.value);
            document.getElementById('slot-select-button').removeEventListener('click', slot_select_onclick);
        }
        document.getElementById('slot-select-button').addEventListener('click', slot_select_onclick);
    }
}

function start_calibration(meas, property) {
    /**
     * Performs the actual prediction of the calibration parameters
     * via the neural network. 
     * Every array of the object has a length of 4096,
     * but only the first 400 entries are required. Also,
     * each spectrum is normalized to its maximum
     * 
     * @param {object} meas Object containing histogrammed number of
     *     events per pixel
     * @param {string} property The property to access the measurement
     *     object. This is either `frames` if a single slot was used, or
     *     `Slot1-3` for the hardware with multiple slots
     */
    let frames = meas[property];
    let tot_hists = [];
    for (let pixel = 0; pixel < 256; pixel++) {
        let temp = [];
        let max = Math.max(...frames[pixel]);
        for (let idx = 0; idx < 400; idx++) {
            temp.push( frames[pixel][idx] / max );
        }
        tot_hists.push( temp );
    }

    console.log('Starting calibration');
    upload_measurement_button.innerHTML = "Calibrating...";

    // Predict calibration parameters
    const input_tensor = tf.tensor(tot_hists, [256, 400, 1]);
    let pred = model.predict(input_tensor);
    pred = Array.from(pred.dataSync());

    // Split to get parameters for every pixel
    var calib_params = [];
    while(pred.length) {
        let pred_splice = pred.splice(0, 4);
        pred_splice[0] *= 1.85;
        pred_splice[1] *= 125;
        pred_splice[2] *= -275;
        pred_splice[3] *= 7.5;
        calib_params.push(pred_splice);
    }

    // Transform bins to deposited energy
    let bins = [];
    for (let pixel = 0; pixel < 256; pixel++) {
        let a = calib_params[pixel][0];
        let b = calib_params[pixel][1];
        let c = calib_params[pixel][2];
        let t = calib_params[pixel][3];

        let bins_pixel = [];
        for (let x = 0; x < 400; x++) {
            let energy = ToT_to_energy(x, a, b, c, t);
            if (energy > 70) continue;
            bins_pixel.push( energy );
            tot_hists[pixel][bins_pixel] /= (bins_pixel[-1] - bins_pixel[-2]);
        }
        bins.push(bins_pixel);
    }

    // Show results
    update_plot(bins, tot_hists);
    plot_sum(bins, tot_hists);
    plot_thl(calib_params);
    document.getElementById('calib-results').style.visibility = 'visible';
    document.getElementById('calib-results-body').style.visibility = 'visible';

    // Provide download of calib params
    calib_download_button.addEventListener('click', () => {
        let json_calib = params_reformat(calib_params);
        let data = new Blob([JSON.stringify(json_calib)], {type: "text/json;charset=utf-8,"});
    
        var a = document.createElement("a");
        a.href = URL.createObjectURL(data);
        a.download = "calib_params.json";
        a.click();
    });

    // Disable button while running
    upload_measurement_button.classList.add('disabled');

    // Enable button
    upload_measurement_button.classList.remove('disabled');
    upload_measurement_button.innerHTML = "Select file to start";
}

function params_reformat(calib_params) {
    /**
     * Reformats the calibration parameters so the results
     * are readable with the Dosepix control softwares
     * 
     * @param {Array} calib_params Array containing the calibration
     *    parameters for each pixel
     */
    let calib_json = {};
    for (var pixel = 0; pixel < 256; pixel++) {
        calib_json[String(pixel)] = {
            'a': calib_params[pixel][0],
            'b': calib_params[pixel][1],
            'c': calib_params[pixel][2],
            't': calib_params[pixel][3],
        }
    }
    return calib_json
}

// === Plot functions ===
function update_plot(bins_energy, hist_tot) {
    /**
     * Update plot that shows the large pixels of the first column
     */
    var data = [];
    for (var pixel = 2; pixel < 14; pixel++) {
        data.push(
            {
                x: bins_energy[pixel],
                y: hist_tot[pixel],
                type: 'scatter',
                name: 'pixel ' + String(pixel),
            }
        );
    }

    let layout = {
        xaxis: {
            title: {
                text: 'Deposited energy (keV)',
            },
        },
    }

    Plotly.newPlot(
        'chart-energy',
        data,
        layout,
    );
}

async function plot_sum(bins_energy, hist_tot) {
    /**
     * Update plot that shows the sum of all large pixels
     */
    let hist_data = await get_sum_spectrum(bins_energy, hist_tot);
    let data = {
        x: hist_data[0],
        y: hist_data[1],
        type: 'scatter',
    }

    let layout = {
        xaxis: {
            title: {
                text: 'Deposited energy (keV)',
            },
        },
    }

    Plotly.newPlot(
        'chart-sum',
        [data],
        layout,
    );
}

function get_sum_spectrum(bins_energy, hist_tot) {
    /**
     * Calculation of the sum spectrum for the large pixels
     */
    const start_bin = 5;
    const end_bin = 70;
    const num_bins = 400;

    var bins_sum = [];
    var hist_sum = [];
    for (var index = 0; index < num_bins; index++) {
        bins_sum.push( start_bin + index * (end_bin - start_bin) / num_bins );
        hist_sum.push( 0 );
    }

    for (var pixel = 0; pixel < 256; pixel++) {
        if (pixel % 16 in [0, 1, 14, 15]) continue;

        let be = bins_energy[pixel];
        let ht = hist_tot[pixel];

        for (var entry = 0; entry < 400; entry++) {
            let idx = Math.floor((be[entry] - start_bin) * num_bins / (end_bin - start_bin));

            if (idx < 0 || isNaN(idx)) continue;
            if ((ht[idx] < 0) || isNaN(ht[idx])) continue;

            hist_sum[idx] += ht[entry];
        }
    }

    return [bins_sum, hist_sum]
}

function get_thl_distribution(calib_params, num_bins=30) {
    // Calculate thl for each pixel
    let thls = [];
    for (let pixel = 0; pixel < 256; pixel++) {
        // Skip small pixels
        if (pixel % 16 in [0, 1, 14, 15]) continue;

        let p = calib_params[pixel];
        let thl = get_THL(...p);
        if (isNaN(thl)) continue;

        thls.push( thl );
    }
    console.log(thls);

    // Find extreme values
    let min = Math.min(...thls);
    let max = Math.max(...thls);
    console.log(max, min);
    
    // Create bins and empty histogram
    let bins = [];
    let hist = [];
    for (let b = 0; b < num_bins; b++) {
        bins.push(min + b * (max - min) / num_bins);
        hist.push(0);
    }

    // Fill histogram
    for (const thl of thls) {
        let idx = Math.floor((thl - min) * num_bins / (max - min));
        if (idx >= num_bins) continue;
        hist[idx]++;
    }

    // Get average
    const sum = thls.reduce((a, b) => a + b, 0);
    const avg = (sum / thls.length) || 0;

    return [bins, hist, avg];
}

function plot_thl(calib_params) {
    let bh = get_thl_distribution(calib_params);
    console.log(bh);
    let data = {
        x: bh[0],
        y: bh[1],
        type: 'bar',
    }

    let layout = {
        xaxis: {
            title: {
                text: 'THL (keV)',
            },
        },
        shapes: [
            {
                type: 'line',
                x0: bh[2],
                y0: 0,
                x1: bh[2],
                y1: 1.1 * Math.max(...bh[1]),
                line: {
                    color: 'rgb(0, 0, 0)',
                    width: 3,
                    dash: 'dashdot',
                }
            }
        ],
    }

    Plotly.newPlot(
        'chart-thl',
        [data],
        layout,
    );
}

// === Main ===
// Load measurement on button press
const meas_upload = () => {
    // Check if file was set
    if (upload_measurement.files.length <= 0) {
        alert("Please provide a measurement file!");
        return;
    }

    predict_meas(upload_measurement.files[0]);
    upload_measurement.value = "";
}

upload_measurement.addEventListener(
    'change',
    meas_upload,
);

// === Execute on page load ===
function on_ready(func) {
    if (document.readyState == "complete" || document.readyState == "interactive") {
        setTimeout(func, 1);
    } else {
        document.addEventListener("DOMContentLoaded", fn);
    }
}

on_ready(async () => {
    before_print_handler();
    model = await load_model('assets/model/DNNCalib_large/model.json');
});
