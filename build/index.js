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
let minScale = 1.25;
let maxScale = 2;
const minColor = 13472076;
const maxColor = 13472332;
const borderSize = 10;
let epilepsyMode = false;
var interval;
let currentlyPlaying = false;
const url = "http://localhost:3001/";
let x = 0;
let prev;
let source;
let analyser;
let dataArray;
const thresholds = [
    { minBound: 0.0, maxBound: 0.3, boost: 1.2 },
    { minBound: 0.3, maxBound: 0.5, boost: 1.15 },
    { minBound: 0.5, maxBound: 0.6, boost: 1.1 },
    { minBound: 0.6, maxBound: 0.75, boost: 1.05 },
    { minBound: 0.75, maxBound: 1.00, boost: 1.0 }
];
const drawFrequency = (frequencyData) => {
    const barWidth = 20;
    let xAxis = 0;
    const freqCanvas = document.getElementById("frequency");
    const context = freqCanvas.getContext('2d');
    context.fillStyle = 'rgb(84, 70, 118)';
    context.fillRect(0, 0, freqCanvas.width, freqCanvas.height);
    for (let i = 0; i < frequencyData.length; i++) {
        const barHeight = (frequencyData[i] + 140) * 2;
        context.fillStyle = `rgb(${Math.floor(barHeight + 100)}, 50, 50)`;
        context.fillRect(xAxis, freqCanvas.height - barHeight / 2, barWidth, barHeight / 2);
        xAxis += barWidth + 1.5;
    }
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
const normalizeValue = (value, min, max, minRange, maxRange, thresholds) => {
    const loudness = (value - min) / (max - min);
    const y = (90 - 10) * loudness + 10;
    const canvas = document.getElementById("myCanvas");
    const ctx = canvas.getContext('2d');
    if (prev) {
        ctx.beginPath();
        ctx.moveTo(prev === null || prev === void 0 ? void 0 : prev.x, prev === null || prev === void 0 ? void 0 : prev.y);
        ctx.lineTo(x, y);
        ctx.stroke();
    }
    if (x >= 1000) {
        x = 0;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    prev = { x, y };
    x += 3;
    const loudnessDiv = document.getElementById("loudness");
    if (loudnessDiv)
        loudnessDiv.style.width = (loudness * 100).toString() + "%";
    // if (!thresholds) 
    return (maxRange - minRange) * (value - min) / (max - min) + minRange;
    /* for (let i = 0; i < thresholds.length; i++) {
        if (i === thresholds.length - 1 || (loudness >= thresholds[i].minBound && loudness < thresholds[i].highBound))
            return ((maxRange - minRange) * loudness + minRange) * thresholds[i].boost;
    }

    return (maxRange - minRange) * (value - min) / (max - min) + minRange; */
};
const readBuffer = () => __awaiter(void 0, void 0, void 0, function* () {
    if (currentlyPlaying)
        return;
    currentlyPlaying = true;
    const circle = document.getElementById("circle");
    const container = document.getElementById("container");
    const audioContext = new AudioContext();
    let buffer;
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
        if (circle) {
            circle.style.transition = "linear all 0.05s";
            circle.style.transform = `scale(${normalizedValue})`;
            if (analyser) {
                dataArray = new Float32Array(analyser.frequencyBinCount);
                analyser.getFloatFrequencyData(dataArray);
                drawFrequency(dataArray);
            }
        }
        if (container && epilepsyMode) {
            const bgColor = normalizeHex(normalizeValue(currentValue, min, max, minColor, maxColor));
            container.style.border = `${borderSize}px solid #${bgColor}`;
        }
        interval = setInterval(() => {
            if (index > bothChannelsAverage.length) {
                if (circle) {
                    circle.style.transition = "ease-in-out all 0.3s";
                    circle.style.transform = "scale(1)";
                }
                clearInterval(interval);
                currentlyPlaying = false;
            }
            if (analyser) {
                dataArray = new Float32Array(analyser.frequencyBinCount);
                analyser.getFloatFrequencyData(dataArray);
                drawFrequency(dataArray);
            }
            const currentValue = bothChannelsAverage[index++];
            let normalizedValue = normalizeValue(currentValue, min, max, minScale, maxScale);
            if (circle)
                circle.style.transform = `scale(${normalizedValue})`;
            if (container && epilepsyMode) {
                const bgColor = normalizeHex(normalizeValue(currentValue, min, max, minColor, maxColor));
                container.style.border = `${borderSize}px solid #${bgColor}`;
            }
        }, intervalMs);
    }
});
const stopSong = () => {
    const container = document.getElementById("container");
    const circle = document.getElementById("circle");
    if (circle) {
        circle.style.transition = "ease-in-out all 0.3s";
        circle.style.transform = "scale(1)";
    }
    if (container)
        container.style.border = `${borderSize}px solid #ffffff`;
    source === null || source === void 0 ? void 0 : source.stop();
    clearInterval(interval);
    currentlyPlaying = false;
};
const toggleEpilepsyMode = () => {
    epilepsyMode = !epilepsyMode;
    const container = document.getElementById("container");
    if (container)
        container.style.border = `${borderSize}px solid #ffffff`;
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
const changeCircleSize = () => {
    const circle = document.getElementById("circle");
    const input = document.getElementById("circleSize");
    const value = Number(input.value);
    circle.style.height = value + "px";
    circle.style.width = value + "px";
};
