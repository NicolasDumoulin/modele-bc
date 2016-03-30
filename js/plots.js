function getOpinions(timestep) {
    // using math.ceil for intermediate timestep
    return opinionsTs[Math.ceil(timestep / timeserieStep)];
}
function refresh(timestep) {
    Plotly.redraw(document.getElementById('plot-indicators'));
    plotOpinions(timestep);
}
function refreshLoop() {
    if (plotsToRefresh > -1) {
        refresh(plotsToRefresh);
        plotsToRefresh = -1;
    }
    if (simulationRun) {
        setTimeout(refreshLoop, 200);
    }
}
function computeNextPlotsTimestep(frequency) {
    if (frequency === 'auto') {
        nextPlotsTimestep = iteration + Math.round(plotDuration / (stepsDuration / iteration) * 6);
    } else if (frequency === 'off') {
        nextPlotsTimestep = -1;
    } else {
        nextPlotsTimestep = iteration + parseInt(frequency, 0);
        if (iteration === 1 && nextPlotsTimestep > iteration + 1) { // fix for first iteration, for avoiding disgracious shift
            nextPlotsTimestep -= 1;
        }
    }
}
function plotOpinions(step) {
    opinions = getOpinions(step);
    var x = opinions[0];
    var y = opinions[1];
    var xHighlyEngaged = opinions[2];
    var yHighlyEngaged = opinions[3];
    var allX = x.concat(xHighlyEngaged);
    var allY = y.concat(yHighlyEngaged);
    var data = [{
            x: x,
            y: y,
            mode: 'markers',
            name: 'points',
            marker: {
                color: 'rgb(102,0,0)',
                size: 2,
                opacity: 0.4
            },
            type: 'scatter'
        }, {
            x: xHighlyEngaged,
            y: yHighlyEngaged,
            mode: 'markers',
            name: 'points',
            marker: {
                color: 'rgb(0,102,0)',
                size: 3,
                opacity: 0.5
            },
            type: 'scatter'
        }, {
            x: allX,
            y: allY,
            name: 'density',
            colorscale: 'Hot',
            reversescale: true,
            showscale: true,
            type: 'histogram2dcontour',
            zmin: 0,
            zmax: pop.population.length / 4,
            contours: {showlines: false},
            // small cell size for more precise cluster detection
            xbins: {start: -1, end: 1, size: 0.1},
            ybins: {start: -1, end: 1, size: 0.1},
            // disable countours on uniform distribution at init
            visible: indicatorsTs.nbIsolatedInd[indicatorsRange.indexOf(step)] < pop.population.length / 6
        }, {
            x: x,
            name: 'opinion 1 density',
            marker: {color: 'rgb(102,0,0)'},
            yaxis: 'y2',
            type: 'histogram'
        }, {
            y: y,
            name: 'opinion 2 density',
            marker: {color: 'rgb(102,0,0)'},
            xaxis: 'x2',
            type: 'histogram'
        }];
    var opinionAxis = {
        range: [-1, 1],
        autorange: false,
        domain: [0, 0.8],
        showgrid: false,
        zeroline: false
    };
    var densityAxis = {
        domain: [0.85, 1],
        showgrid: false,
        zeroline: false
    };
    var layout = {
        title: 'Opinions densities at step ' + step,
        showlegend: false,
        autosize: false,
        width: 580,
        height: 550,
        margin: {t: 50},
        hovermode: 'closest',
        bargap: 0,
        xaxis: $.extend({title: 'opinion 1'}, opinionAxis),
        yaxis: $.extend({title: 'opinion 2'}, opinionAxis),
        xaxis2: densityAxis,
        yaxis2: densityAxis
    };
    p = Plotly.newPlot('plot-opinions', data, layout);
    return [p, x, y];
}
function initPlotIndicators(indicatorsTs) {
    var trace1 = {
        name: 'nb clusters',
        x: indicatorsRange,
        y: indicatorsTs.nbClusters,
        type: 'scatter'
    };
    var traceIsolatedInd = {
        name: 'nb isolated ind',
        x: indicatorsRange,
        y: indicatorsTs.nbIsolatedInd,
        type: 'scatter'
    };
    var trace2 = {
        name: 'opinion 1',
        x: indicatorsRange,
        y: indicatorsTs.opAvg0,
        yaxis: 'y2',
        type: 'scatter'
    };
    var trace3 = {
        name: 'opinion 2',
        x: indicatorsRange,
        y: indicatorsTs.opAvg1,
        yaxis: 'y2',
        type: 'scatter'
    };
    var data = [trace1, traceIsolatedInd, trace2, trace3];
    Plotly.newPlot('plot-indicators', data, {width: 600, height: 550, yaxis: {title: 'nb clusters', range: [0, pop.population.length]},
        yaxis2: {
            title: 'opinions mean (absolute values)',
            range: [0, 1],
            overlaying: 'y',
            side: 'right'
        }});
}
function updatePlotIndicators(timestep) {
    var opinions = getOpinions(timestep);
    // find where the data should be inserted in the timeseries
    var insertionIndex = indicatorsRange.findIndex(function (x) {
        return x > timestep;
    });
    if (insertionIndex < 0) {
        // no index greater, so we should append to the end
        insertionIndex = indicatorsRange.length;
    } else if (indicatorsRange[insertionIndex] === timestep) {
        // indicators for this timestep have been already computed, so passing
        return;
    }
    var clusters = getClusters(opinions, 0.01);
    indicatorsTs.nbIsolatedInd.splice(insertionIndex, 0, clusters[0]);
    indicatorsTs.nbClusters.splice(insertionIndex, 0, clusters[1].length);
    indicatorsTs.opAvg0.splice(insertionIndex, 0, getOpAvg(opinions, 0));
    indicatorsTs.opAvg1.splice(insertionIndex, 0, getOpAvg(opinions, 1));
    indicatorsRange.splice(insertionIndex, 0, timestep);
    plotsToRefresh = timestep;
}
function getOpAvg(opinions, subj) {
    return opinions[subj].reduce(function (prev, cur) {
        return prev + Math.abs(cur);
    }, 0) / opinions[subj].length;
}
/**
 * Creates a new array with all elements that pass the test implemented
 *  by the provided function, and removes the found elements from
 *  the original array.
 * @param filter the function to test the elements
 * @returns {Array|Array.prototype.filterAndRemove.result}
 */
Array.prototype.filterAndRemove = function (filter) {
    var result = [];
    for (var i = this.length - 1; i >= 0; i--) {
        if (filter(this[i])) {
            result.push(this.splice(i, 1));
        }
    }
    return result;
};
function getClusters(opinions, epsilon) {
    // gathering index of moderate individuals
    var todo = range(opinions[0].length).filter(function (indIndex) {
        return extremistId.indexOf(indIndex) < 0;
    });
    var clusters = [];
    var nbIsolatedIndividuals = 0;
    while (todo.length > 0) {
        var currentIndex = todo.pop();
        var currentIndiv = [opinions[0][currentIndex], opinions[1][currentIndex]];
        var currentCluster = [currentIndiv].concat(todo.filterAndRemove(function (elt) {
            return Individual.distance(currentIndiv[0], currentIndiv[1], opinions[0][elt], opinions[1][elt]) < epsilon;
        }));
        if (currentCluster.length >= pop.population.length / 100) {
            clusters.push(currentCluster);
        } else {
            nbIsolatedIndividuals += currentCluster.length;
        }
    }
    return [nbIsolatedIndividuals, clusters];
}
 