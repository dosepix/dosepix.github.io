/* === FEATURE CARDS === */
var tot_card = document.getElementById('tot-card');
var energy_binning_card = document.getElementById('energy-binning-card');
var integration_card = document.getElementById('integration-card');

var tot_text = document.getElementById('tot-text');
var energy_binning_text = document.getElementById('energy-binning-text');
var integration_text = document.getElementById('integration-text');

var features_collapse = document.getElementById('features-collapse');
var selected_feature = undefined;

function collapse_and_extend() {
    // Collapse
    /*
    if (features_collapse.style.maxHeight){
        features_collapse.style.maxHeight = null;
    }
    */

    // Extend
    features_collapse.style.maxHeight = features_collapse.scrollHeight + "px";
    features_collapse.scrollIntoView({
        behavior: "smooth", 
        block: "start", 
        inline: "start"
    });
}

var plot_interval_tot = undefined;
var plot_interval_binning = undefined;
var plot_interval_integration = undefined;

function disable_plot(plot_interval) {
    if (plot_interval != undefined) {
        clearInterval(plot_interval);
        plot_interval = undefined;
    }
}

tot_card.addEventListener('click', () => {
    if (selected_feature == 'tot') {
        return;
    }
    collapse_and_extend();
    selected_feature = 'tot';

    tot_text.style.display = 'inline';
    energy_binning_text.style.display = 'none';
    integration_text.style.display = 'none';

    disable_plot(plot_interval_binning);
    disable_plot(plot_interval_integration);
    plot_interval_tot = setInterval(plot_tot, 100);
});

energy_binning_card.addEventListener('click', () => {
    if (selected_feature == 'energy_binning') {
        return;
    }
    collapse_and_extend();
    selected_feature = 'energy_binning';

    tot_text.style.display = 'none';
    energy_binning_text.style.display = 'inline';
    integration_text.style.display = 'none';

    disable_plot(plot_interval_tot);
    disable_plot(plot_interval_integration);
    plot_interval_binning = setInterval(plot_binning, 100);
});

integration_card.addEventListener('click', () => {
    if (selected_feature == 'integration') {
        return;
    }
    collapse_and_extend();
    selected_feature = 'integration';

    tot_text.style.display = 'none';
    energy_binning_text.style.display = 'none';
    integration_text.style.display = 'inline';

    disable_plot(plot_interval_tot);
    disable_plot(plot_interval_binning);
    plot_interval_integration = setInterval(plot_integral, 100);
});

/* === FEATURE PLOT === */
const bins = [10.0, 10.5, 11.0, 11.5, 12.0, 12.5, 13.0, 13.5, 14.0, 14.5, 15.0, 15.5, 16.0, 16.5, 17.0, 17.5, 18.0, 18.5, 19.0, 19.5, 20.0, 20.5, 21.0, 21.5, 22.0, 22.5, 23.0, 23.5, 24.0, 24.5, 25.0, 25.5, 26.0, 26.5, 27.0, 27.5, 28.0, 28.5, 29.0, 29.5, 30.0, 30.5, 31.0, 31.5, 32.0, 32.5, 33.0, 33.5, 34.0, 34.5, 35.0, 35.5, 36.0, 36.5, 37.0, 37.5, 38.0, 38.5, 39.0, 39.5, 40.0, 40.5, 41.0, 41.5, 42.0, 42.5, 43.0, 43.5, 44.0, 44.5, 45.0, 45.5, 46.0, 46.5, 47.0, 47.5, 48.0, 48.5, 49.0, 49.5, 50.0, 50.5, 51.0, 51.5, 52.0, 52.5, 53.0, 53.5, 54.0, 54.5, 55.0, 55.5, 56.0, 56.5, 57.0, 57.5, 58.0, 58.5, 59.0, 59.5, 60.0, 60.5, 61.0, 61.5, 62.0, 62.5, 63.0, 63.5, 64.0, 64.5, 65.0, 65.5, 66.0, 66.5, 67.0, 67.5, 68.0, 68.5, 69.0];
const hist = [1626, 1858, 3716, 2839, 969, 736, 587, 431, 340, 280, 330, 483, 781, 1136, 1359, 1163, 913, 671, 437, 348, 179, 149, 95, 95, 77, 87, 72, 79, 88, 74, 78, 73, 72, 57, 48, 55, 43, 42, 56, 51, 53, 52, 52, 42, 32, 46, 39, 61, 48, 56, 37, 44, 48, 50, 44, 53, 52, 58, 67, 48, 62, 60, 62, 55, 67, 77, 81, 74, 100, 97, 101, 102, 108, 112, 117, 128, 110, 111, 99, 102, 109, 111, 106, 120, 117, 112, 117, 119, 138, 208, 258, 379, 481, 707, 684, 874, 856, 753, 611, 479, 282, 222, 109, 46, 35, 16, 4, 4, 2, 2, 1, 1, 0, 1, 1, 1, 0, 0, 0];

// Normalize hist
ratio = Math.max.apply(Math, hist);
for (let i = 0; i < hist.length; i++) {
    hist[i] /= ratio;
}

var config = {
    type: 'bar',
    options: {
        responsive: true,
        animation : false,
        scales: {
            y: {
                title: {
                    display: true,
                    text: "Registered events",
                    font: {
                        size: 20,
                    },    
                },
            },
            x: {
                title: {
                    display: true,
                    text: "Deposited energy (keV)",
                    font: {
                        size: 20,
                    },    
                },
            },
        },
        layout: {
            padding: 30,
        },
        plugins: {
            legend: {
                display: false,
            },
        },
    },
}

const chart = new Chart(
    document.getElementById('chart'),
    config,
);

function get_random(min, max) {
    return min + Math.random() * (max - min);
}

function get_index() {
    let rand = get_random(bins[0], bins[bins.length - 1]);
    let x = Math.floor((rand * 2) + 0.5) / 2.;
    return (x - bins[0]) * 2;
}

function rejection_sampling() {
    let idx = get_index();

    let p = 2;
    while (p > hist[idx]) {
        p = Math.random();
        idx = get_index();
    }
    return idx;
}

var hist_rand = new Array(bins.length).fill(0);
function plot_tot() {
    let idx = rejection_sampling();
    hist_rand[idx]++;

    let data = {
        labels: bins,
        datasets: [{
            data: hist_rand,
        }]
    }    
    chart.data = data;
    chart.update();
}

var hist_binning = new Array(16).fill(0);
var bins_n = (bins[bins.length - 1] - bins[0]) * 2;
var bins_binning = [];
for (let i = 0; i < 16; i++) {
    let num = (i / 16.) * (bins[bins.length - 1] - bins[0]) + bins[0];
    num = Math.floor(num * 100) / 100.;
    bins_binning.push(num);
}

function plot_binning() {
    let idx = rejection_sampling();
    let bin_idx = Math.floor( idx * 16. / bins_n )
    hist_binning[bin_idx]++;

    let data = {
        labels: bins_binning,
        datasets: [{
            data: hist_binning,
        }]
    }    
    chart.data = data;
    chart.update();
}

var hist_int = new Array(100).fill(0);
var bins_int = [];
var scale = 10.
for (let i = 0; i < hist_int.length; i++) {
    bins_int.push(i * scale);
}

function poisson(lambda) {
	var p = Math.random();
	var k = 1;
	while ( p > Math.exp( -lambda ) ) {
		k += 1;
		p *= Math.random();
	}
	return k - 1;
}

function plot_integral() {
    let n = poisson(15);
    let energy = 0;
    for (let i = 0; i < n; i++) {
        energy += bins[rejection_sampling()];
    }
    hist_int[Math.floor(energy / scale)]++;

    let data = {
        labels: bins_int,
        datasets: [{
            data: hist_int,
        }]
    }    
    chart.data = data;
    chart.update();
}

/* === BURGER === */
const toggleBurger = () => {
    let burgerIcon = document.getElementById('burger');
    let dropMenu = document.getElementById('contents');
    burgerIcon.classList.toggle('is-active');
    dropMenu.classList.toggle('is-active');
};
