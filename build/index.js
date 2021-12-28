"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const intervalMs = 25;
const minColor = 13472076;
const maxColor = 13472364;
const borderSize = 10;
const minContainerScale = 0.985;
const maxContainerScale = 1.025;
const freqGraphCanvas = document.getElementById("freqGraph");
const freqGraphCtx = freqGraphCanvas.getContext('2d');
freqGraphCtx.fillStyle = "#ff3232";
freqGraphCtx.strokeStyle = "#ff3232";
freqGraphCtx.beginPath();
freqGraphCtx.moveTo(0, freqGraphCanvas.height / 2);
freqGraphCtx.lineTo(freqGraphCanvas.width, freqGraphCanvas.height / 2);
freqGraphCtx.stroke();
const freqBarsCanvas = document.getElementById("freqBars");
const freqBarsCtx = freqBarsCanvas.getContext('2d');
const loudnessDiv = document.getElementById("loudnessBar");
const blob = document.getElementById("blob");
const blobContainer = document.getElementById("blobContainer");
let minScale = 1.25;
let maxScale = 2;
let epilepsyMode = false;
let interval;
let currentlyPlaying = false;
let freqGraphX = 0;
let prev;
let source;
let analyser;
let dataArray;
let url = "http://localhost:3001/"; // Default
const thresholds = [
    { minBound: 0.0, maxBound: 0.3, boost: 1.2 },
    { minBound: 0.3, maxBound: 0.5, boost: 1.15 },
    { minBound: 0.5, maxBound: 0.6, boost: 1.1 },
    { minBound: 0.6, maxBound: 0.75, boost: 1.05 },
    { minBound: 0.75, maxBound: 1.00, boost: 1.0 }
];
const drawFrequencyBars = (frequencyData) => {
    const barWidth = 20;
    let freqBarsX = 0;
    freqBarsCtx.fillStyle = 'rgb(84, 70, 118)';
    freqBarsCtx.fillRect(0, 0, freqBarsCanvas.width, freqBarsCanvas.height);
    for (let i = 0; i < frequencyData.length; i++) {
        const barHeight = (frequencyData[i] + 140) * 2;
        freqBarsCtx.fillStyle = `rgb(${Math.floor(barHeight + 100)}, 50, 50)`;
        freqBarsCtx.fillRect(freqBarsX, freqBarsCanvas.height - barHeight / 2, barWidth, barHeight / 2);
        freqBarsX += barWidth + 1.5;
    }
};
const drawFrequencyGraph = (value, min, max) => {
    const loudness = (value - min) / (max - min);
    const height = (45 - (-45)) * loudness + (-45);
    freqGraphCtx.fillStyle = "#ff3232";
    freqGraphCtx.strokeStyle = "#ff3232";
    freqGraphCtx.fillRect(freqGraphX, freqGraphCanvas.height / 2, 2, height);
    if (freqGraphX >= 1000) {
        freqGraphX = 0;
        freqGraphCtx.clearRect(0, 0, freqGraphCanvas.width, freqGraphCanvas.height);
        freqGraphCtx.beginPath();
        freqGraphCtx.moveTo(0, freqGraphCanvas.height / 2);
        freqGraphCtx.lineTo(freqGraphCanvas.width, freqGraphCanvas.height / 2);
        freqGraphCtx.stroke();
    }
    freqGraphX += 2;
};
const normalizeHex = (value) => {
    let bgColor = Math.round(value).toString(16);
    let normalizedColor = "";
    if (bgColor.length < 6) {
        const missingChars = 6 - bgColor.length;
        for (let i = 0; i < missingChars; i++)
            normalizedColor += "0";
    }
    normalizedColor += bgColor;
    return normalizedColor;
};
const normalizeValue = (value, min, max, minRange, maxRange) => {
    const loudness = (value - min) / (max - min);
    if (loudnessDiv)
        loudnessDiv.style.width = (loudness * 100).toString() + "%";
    /* if (!thresholds)
        return (maxRange - minRange) * (value - min) / (max - min) + minRange; */
    /* for (let i = 0; i < thresholds.length; i++) {
        if (i === thresholds.length - 1 || (loudness >= thresholds[i].minBound && loudness < thresholds[i].highBound))
            return ((maxRange - minRange) * loudness + minRange) * thresholds[i].boost;
    } */
    return (maxRange - minRange) * (value - min) / (max - min) + minRange;
};
const readBuffer = () => __awaiter(void 0, void 0, void 0, function* () {
    if (currentlyPlaying)
        return;
    currentlyPlaying = true;
    const audioContext = new AudioContext();
    let buffer;
    const urlInput = document.getElementById("url");
    if (urlInput && urlInput.value && urlInput.value !== "") {
        url = urlInput.value;
    }
    const res = yield fetch(url);
    const resBuffer = yield res.arrayBuffer();
    let leftChannelBuffer;
    let rightChannelBuffer;
    const leftChannelAverages = new Array();
    const rightChannelAverages = new Array();
    const bothChannelsAverage = new Array();
    let length;
    yield audioContext.decodeAudioData(resBuffer, (finalBuffer) => {
        buffer = finalBuffer;
        length = finalBuffer.duration;
        leftChannelBuffer = finalBuffer.getChannelData(0);
        if (finalBuffer.numberOfChannels === 2)
            rightChannelBuffer = finalBuffer.getChannelData(1);
    }, (err) => console.log(err));
    if (leftChannelBuffer && length) {
        const bytesPerSecond = Math.ceil(leftChannelBuffer.length / length);
        const chunkSize = Math.ceil(bytesPerSecond * (intervalMs / 1000));
        for (let i = 0; i < leftChannelBuffer.length; i += chunkSize) {
            let slicedArray = leftChannelBuffer.slice(i, i + chunkSize + 1);
            let chunkSum = slicedArray.reduce((acc, item) => acc + item, 0.0);
            leftChannelAverages.push(chunkSum / slicedArray.length);
            if (rightChannelBuffer) {
                slicedArray = rightChannelBuffer.slice(i, i + chunkSize + 1);
                chunkSum = slicedArray.reduce((acc, item) => acc + item, 0.0);
                rightChannelAverages.push(chunkSum / slicedArray.length);
            }
        }
        if (leftChannelBuffer && rightChannelBuffer)
            leftChannelAverages.map((item, index) => { bothChannelsAverage.push((item + rightChannelAverages[index]) / 2); });
        else
            bothChannelsAverage.push(...leftChannelAverages.slice(0));
        const min = Math.min(...bothChannelsAverage);
        const max = Math.max(...bothChannelsAverage);
        let index = 0;
        if (buffer) {
            source = audioContext.createBufferSource();
            source.buffer = buffer;
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 64;
            analyser.connect(audioContext.destination);
            source.connect(analyser);
            source.start();
        }
        const currentValue = bothChannelsAverage[index++];
        let normalizedValue = normalizeValue(currentValue, min, max, minScale, maxScale);
        drawFrequencyGraph(currentValue, min, max);
        if (blob) {
            blob.style.transition = "ease-in-out all 0.05s";
            blob.style.transform = `scale(${normalizedValue})`;
            if (analyser) {
                dataArray = new Float32Array(analyser.frequencyBinCount);
                analyser.getFloatFrequencyData(dataArray);
                drawFrequencyBars(dataArray);
            }
        }
        if (blobContainer && epilepsyMode) {
            const containerScale = normalizeValue(currentValue, min, max, minContainerScale, maxContainerScale);
            blobContainer.style.transform = `scale(${containerScale})`;
        }
        interval = setInterval(() => {
            if (index > bothChannelsAverage.length) {
                if (blob) {
                    blob.style.transition = "ease-in-out all 0.3s";
                    blob.style.transform = "scale(1)";
                }
                clearInterval(interval);
                currentlyPlaying = false;
                freqGraphX = 0;
                freqGraphCtx.beginPath();
                freqGraphCtx.clearRect(0, 0, freqGraphCanvas.width, freqGraphCanvas.height);
                freqGraphCtx.fillStyle = "#ff3232";
                freqGraphCtx.strokeStyle = "#ff3232";
                freqGraphCtx.moveTo(0, freqGraphCanvas.height / 2);
                freqGraphCtx.lineTo(freqGraphCanvas.width, freqGraphCanvas.height / 2);
                freqGraphCtx.stroke();
            }
            if (analyser) {
                dataArray = new Float32Array(analyser.frequencyBinCount);
                analyser.getFloatFrequencyData(dataArray);
                drawFrequencyBars(dataArray);
            }
            const currentValue = bothChannelsAverage[index++];
            let normalizedValue = normalizeValue(currentValue, min, max, minScale, maxScale);
            drawFrequencyGraph(currentValue, min, max);
            if (blob)
                blob.style.transform = `scale(${normalizedValue})`;
            if (blobContainer && epilepsyMode) {
                const containerScale = normalizeValue(currentValue, min, max, minContainerScale, maxContainerScale);
                blobContainer.style.transform = `scale(${containerScale})`;
            }
        }, intervalMs);
    }
});
const stopSong = () => {
    if (blob) {
        blob.style.transition = "ease-in-out all 0.3s";
        blob.style.transform = "scale(1)";
    }
    freqGraphX = 0;
    freqGraphCtx.beginPath();
    freqGraphCtx.clearRect(0, 0, freqGraphCanvas.width, freqGraphCanvas.height);
    freqGraphCtx.fillStyle = "#ff3232";
    freqGraphCtx.strokeStyle = "#ff3232";
    freqGraphCtx.moveTo(0, freqGraphCanvas.height / 2);
    freqGraphCtx.lineTo(freqGraphCanvas.width, freqGraphCanvas.height / 2);
    freqGraphCtx.stroke();
    if (blobContainer)
        blobContainer.style.border = `${borderSize}px solid #ffffff`;
    source === null || source === void 0 ? void 0 : source.stop();
    clearInterval(interval);
    currentlyPlaying = false;
};
const toggleEpilepsyMode = () => {
    epilepsyMode = !epilepsyMode;
    if (blobContainer)
        blobContainer.style.transform = "scale(1)";
};
const changeMinScale = () => {
    const input = document.getElementById("minScale");
    const value = Number(input.value);
    if (value > maxScale) {
        input.value = maxScale - 0.1;
        return;
    }
    minScale = value;
};
const changeMaxScale = () => {
    const input = document.getElementById("maxScale");
    const value = Number(input.value);
    if (value < minScale) {
        input.value = minScale + 0.1;
        return;
    }
    maxScale = value;
};
const changeBlobSize = () => {
    const input = document.getElementById("circleSize");
    const value = Number(input.value);
    if (blob) {
        blob.style.height = value + "px";
        blob.style.width = value + "px";
    }
};
