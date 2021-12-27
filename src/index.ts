const intervalMs = 25;
let minScale = 1.25;
let maxScale = 2;
const minColor = 16500000;
const maxColor = 16600000;
const borderSize = 10;
let epilepsyMode = false;
var interval: number | undefined;
let currentlyPlaying = false;
const url = "http://localhost:3001/";

const normalizeHex = (value: number) => {
    let bgColor = Math.round(value).toString(16);
    let normalizedColor = "";

    if (bgColor.length < 6) {
        const missingChars = 6 - bgColor.length;
        for (let i = 0; i < missingChars; i++) normalizedColor += "0";
    }

    normalizedColor += bgColor;

    return normalizedColor;
}

const normalizeValue = (value: number, min: number, max: number, minRange: number, maxRange: number) => {
    return (maxRange - minRange) * (value - min) / (max - min) + minRange;
}

const readBuffer = async () => {
    if (currentlyPlaying) return;
    currentlyPlaying = true;
    const audioContext = new AudioContext();
    const audioTag = document.getElementById("song");
    const circle = document.getElementById("circle");
    const container = document.getElementById("container");

    if (audioTag) (audioTag as any).src = url;

    const res = await fetch(url);
    const buffer = await res.arrayBuffer();
    let leftChannelBuffer: Float32Array | undefined;
    let rightChannelBuffer: Float32Array | undefined;
    const leftChannelAverages: number[] = new Array();
    const rightChannelAverages: number[] = new Array();
    const bothChannelsAverage: number[] = new Array();

    let length: number | undefined;

    await audioContext.decodeAudioData(buffer, (res) => {
        length = res.duration;
        leftChannelBuffer = res.getChannelData(0);
        rightChannelBuffer = res.getChannelData(1);
    }, (err) => console.log(err));

    if (leftChannelBuffer && rightChannelBuffer && length) {
        const bytesPerSecond = Math.ceil(leftChannelBuffer.length / length);
        const chunkSize = Math.ceil(bytesPerSecond * (intervalMs / 1000));

        for (let i = 0; i < leftChannelBuffer.length; i += chunkSize) {
            const slicedArray = leftChannelBuffer.slice(i, i + chunkSize + 1);
            const chunkSum = slicedArray.reduce((acc, item) => acc + item, 0.0);
            leftChannelAverages.push(chunkSum / slicedArray.length);
        }

        for (let i = 0; i < rightChannelBuffer.length; i += chunkSize) {
            const slicedArray = rightChannelBuffer.slice(i, i + chunkSize + 1);
            const chunkSum = slicedArray.reduce((acc, item) => acc + item, 0.0);
            rightChannelAverages.push(chunkSum / slicedArray.length);
        }

        leftChannelAverages.map((item, index) => { bothChannelsAverage.push((item + rightChannelAverages[index]) / 2) });

        const min = Math.min(...bothChannelsAverage);
        const max = Math.max(...bothChannelsAverage);

        let index = 0;

        if (audioTag) {
            (audioTag as any).currentTime = 0;
            (audioTag as any).play();
        } 
        
        const currentValue = bothChannelsAverage[index++];
        const bgColor = normalizeHex(normalizeValue(currentValue, min, max, minColor, maxColor));
        let normalizedValue = normalizeValue(currentValue, min, max, minScale, maxScale);

        if (circle) {
            circle.style.transition = "0.0125s ease-in-out all";
            circle.style.transform = `scale(${normalizedValue})`; 
        }

        if (container && epilepsyMode) container.style.border = `${borderSize}px solid #${bgColor}`;
        
        interval = setInterval(() => {
            if (index > bothChannelsAverage.length) {
                if (circle) {
                    circle.style.transition = "0.3s ease-in-out all";
                    circle.style.transform = "scale(1)";
                } 
                clearInterval(interval);
                currentlyPlaying = false;
            } 
            const currentValue = bothChannelsAverage[index++];
            const bgColor = normalizeHex(normalizeValue(currentValue, min, max, minColor, maxColor));
            let normalizedValue = normalizeValue(currentValue, min, max, minScale, maxScale);

            if (circle) circle.style.transform = `scale(${normalizedValue})`;
            if (container && epilepsyMode) container.style.border = `${borderSize}px solid #${bgColor}`;
        }, intervalMs)
    }
}

const stopSong = () => {
    const container = document.getElementById("container");
    const circle = document.getElementById("circle");
    if (circle) {
        circle.style.transition = "0.3s ease-in-out all";
        circle.style.transform = "scale(1)";
    }
    if (container) container.style.border = `${borderSize}px solid #ffffff`;
    const audioTag = document.getElementById("song");
    if (audioTag) (audioTag as any).pause();
    clearInterval(interval);
    currentlyPlaying = false;
}

const toggleEpilepsyMode = () => {
    epilepsyMode = !epilepsyMode;
    const container = document.getElementById("container");
    if (container) container.style.border = `${borderSize}px solid #ffffff`;
}

const changeMinScale = () => {
    const input = document.getElementById("minScale");
    const value = Number((input as any).value);
    if (value > maxScale) {
        (input as any).value = maxScale - 0.1;
        return;
    } 
    minScale = value;
}

const changeMaxScale = () => {
    const input = document.getElementById("maxScale");
    const value = Number((input as any).value);
    if (value < minScale) {
        (input as any).value = minScale + 0.1;
        return;
    } 
    maxScale = value;
}

const changeCircleSize = () => {
    const circle = document.getElementById("circle");
    const input = document.getElementById("circleSize");
    const value = Number((input as any).value);
    (circle as any).style.height = value + "px";
    (circle as any).style.width = value + "px";
}