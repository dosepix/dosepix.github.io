var upload_measurement = document.getElementById('upload-measurement');
var upload_measurement_button = document.getElementById('upload-measurement-button');
var calib_download_button = document.getElementById('calib-download-button');

// Calibration neural network model
var model = undefined;

function before_print_handler () {
    document.getElementById('calib-results').style.visibility = 'hidden';
    document.getElementById('calib-results-body').style.visibility = 'hidden';
}

async function load_model(file) {
    // Load neural net
    try {
        const model = await tf.loadLayersModel(file);
        return model;
    } catch(err) {
        return undefined;
    }
}

async function load_meas_file(file) {
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

function ToT_to_energy(x, a, b, c, t) {
    return 1./(2*a) * ( t*a + x - b + Math.sqrt((b + t*a - x)**2 - 4*a*c) );
}

upload_measurement.addEventListener('change', () => {
    predict_meas(upload_measurement.files);
});

async function predict_meas(files) {
    if (model == undefined) {
        alert("Could not load neural network!");
        return;
    }

    // Check if file was set
    if (files.length <= 0) {
        alert("Please provide a measurement file!");
        return;
    }

    // Check if file has the correct format
    let meas_file = files[0];
    if (meas_file.type != "application/json") {
        alert("File must be in .json-format!");
        return;
    }

    // Load file
    let meas = await load_meas_file(meas_file);

    // Check structure of object
    if (!meas.hasOwnProperty('frames')) {
        alert("Provided file has wrong format!");
        return;
    }

    // Every array of the object has a length of 4096,
    // but only the first 400 entries are required. Also,
    // each spectrum is normalized to its maximum
    let frames = meas.frames;
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
    document.getElementById('calib-results').style.visibility = 'visible';
    document.getElementById('calib-results-body').style.visibility = 'visible';

    // Provide download of calib params
    calib_download_button.addEventListener('click', () => {
        let json_calib = params_reformat(calib_params);
        // let data = "text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(json_calib));
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

function update_plot(bins_energy, hist_tot) {
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

    Plotly.newPlot(
        'chart-energy',
        data,
    );
}

async function plot_sum(bins_energy, hist_tot) {
    let hist_data = await get_sum_spectrum(bins_energy, hist_tot);
    let data = {
        x: hist_data[0],
        y: hist_data[1],
        type: 'scatter',
    }

    Plotly.newPlot(
        'chart-sum',
        [data],
    );
}

function get_sum_spectrum(bins_energy, hist_tot) {
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
