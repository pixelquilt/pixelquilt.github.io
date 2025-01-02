// TODO: maybe warn if load or new without saving?

const baseWorkerCodeBefore = "\n\
  function set(x, y, r, g, b) {\n\
    postMessage({cmd: 'set', x: x, y: y, r: r, g: g, b: b});\n\
  }\n\
  \n\
  async function wait(seconds) {\n\
    postMessage({cmd: 'draw'});\n\
  	if (seconds > 0) {\n\
    	await new Promise(resolve => setTimeout(resolve, seconds * 1000));\n\
    }\n\
  }\n\
  \n\
  async function execute() {\n\
";

const baseWorkerCodeAfter= "\n\
  }\n\
  \n\
  async function loop() {\n\
    try {\n\
      while (true) {\n\
        postMessage({cmd: 'start'});\n\
        await execute();\n\
				await new Promise(resolve => setTimeout(resolve, 17));\n\
      }\n\
    } catch (e) {\n\
      postMessage({cmd: 'error', str: e.toString()});\n\
    }\n\
  }\n\
  loop();\n\
";

const renderWorkerCodeBefore = "\n\
  function set(x, y, r, g, b) {\n\
    postMessage({cmd: 'render', x: x, y: y, r: r, g: g, b: b});\n\
  }\n\
  \n\
  async function wait(seconds) {\n\
    if (seconds > 0) {\n\
      postMessage({cmd: 'advance', s: seconds});\n\
    }\n\
  }\n\
  \n\
  async function execute() {\n\
";

const renderWorkerCodeAfter= "\n\
  }\n\
  \n\
  async function loop() {\n\
    try {\n\
			postMessage({cmd: 'startRender'});\n\
      await execute();\n\
			postMessage({cmd: 'endRender'});\n\
    } catch (e) {\n\
      postMessage({cmd: 'error', str: e.toString()});\n\
    }\n\
  }\n\
  loop();\n\
";

const titleAdjectives = [
	"Round",
  "Happy",
  "Red",
  "Green",
  "Blue",
  "Fancy",
  "Open",
  "Grey",
  "White",
  "Black",
  "Silly",
  "Big",
  "Small",
  "Short",
  "Tall",
  "Bold",
  "Brave",
  "Cosy",
  "Dusty",
  "Exact",
  "Fair",
  "Giddy",
  "Glad",
  "Handy",
  "Huge",
  "Jolly",
  "Just",
  "Keen",
  "Kind",
  "Loyal",
  "Nice",
  "Neat",
  "Noble",
  "Odd",
  "Pale",
  "Pure",
  "Quiet",
  "Quick",
  "Rapid",
  "Rich",
  "Rare",
  "Sunny",
  "Sweet",
  "Thin",
  "Vocal",
  "Warm",
  "Witty",
  "Wavy",
  "Wild",
  "Zippy"
];
const titleShapes = [
  "Circle",
  "Square",
  "Rhombus",
  "Triangle",
  "Star",
  "Heart",
  "Diamond",
  "Oval",
  "Ellipse",
  "Kite",
  "Hexagon",
  "Pyramid",
  "Cube",
  "Sphere",
  "Prism",
  "Cone",
  "Box",
  "Moon",
  "Cross",
  "Arrow",
  "Octagon"
];

let videoWidth = 32;
let videoHeight = 32;
let runCode = null;
let currentFrame = -1;
let waitTime = 0;
let pendingAbort = false;
let running = false;
let worker = null;
let codeBlob = null;
let currentData = null;

function clampint(x) {
  x = x | 0;
  if (x < 0) return 0;
  if (x > 255) return 255;
  return x;
}

function setImpl(x, y, r, g, b) {
  if (x >= 0 && x < videoWidth && y >= 0 && y < videoHeight && currentData) {
    let offset = 4 * ((x | 0) + videoWidth * (y | 0));
    currentData.data[offset] = clampint(r);
    currentData.data[offset + 1] = clampint(g);
    currentData.data[offset + 2] = clampint(b);
  }
}

function onWorkerMessage(ev) {
	let data = ev.data;
  if (data.cmd == "set") {
  	setImpl(data.x, data.y, data.r, data.g, data.b);
  } else if (data.cmd == "draw") {
    if (currentData) {
      let ctx = document.querySelector("#output").getContext('2d');
      ctx.putImageData(currentData, 0, 0);
    }
  } else if (data.cmd == "error") {
    document.querySelector("#error").innerText = "Error running code: " + data.str;
    document.querySelector("#output").style.display = "none";
    document.querySelector("#error").style.display = "block";
    console.log("Error running code: " + data.str);
  } else if (data.cmd == "start") {
    document.querySelector("#output").style.display = "block";
    document.querySelector("#error").style.display = "none";
    let ctx = document.querySelector("#output").getContext('2d');
    if (currentData) {
      ctx.putImageData(currentData, 0, 0);
    }
    currentData = ctx.createImageData(videoWidth, videoHeight);
    for (let i = 0; i < 4 * videoWidth * videoHeight; ++i) {
      currentData.data[i] = (i % 4 == 3) ? 255 : 0;
    }
  }
}

function translateCode(code) {
	let lines = code.split("\n");
  let translated = lines.map(line => {
  	if (line.trimLeft().startsWith("wait(")) {
    	return "await " + line;
    } else {
    	return line;
    }
  });
  return translated.join("\n");
}

function resetVideo() {
  if (worker) {
  	worker.removeEventListener("message", onWorkerMessage);
    worker.terminate();
    worker = null;
  }
  let rawCode = document.querySelector("#editor").value;
	try {
  	localStorage.setItem("code", rawCode);
  } catch (e) {
  }
  let translated = translateCode(rawCode);
	try {
  	runCode = new async function() {}.constructor("set", "wait", translated);
  } catch (e) {
    document.querySelector("#error").innerText = "Could not parse code: " + e;
    document.querySelector("#output").style.display = "none";
    document.querySelector("#error").style.display = "block";
  	console.log("Could not parse code: " + e);
    return;
  }
  codeBlob = new Blob(
  	[baseWorkerCodeBefore, translated, baseWorkerCodeAfter],
    {type: "text/javascript"});
  let url = URL.createObjectURL(codeBlob);
  worker = new Worker(url);
  worker.addEventListener("message", onWorkerMessage);
  document.querySelector("#output").style.display = "block";
  document.querySelector("#error").style.display = "none";
	let ctx = document.querySelector("#output").getContext('2d');
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, videoWidth, videoHeight);
}

function onSizeChange(ev) {
	let width = document.querySelector("#width").value | 0;
  let height = document.querySelector("#height").value | 0;
  if (width > 0 && width <= 512) {
	  videoWidth = width;
  }
  if (height > 0 && height <= 512) {
  	videoHeight = height;
  }
  let canvas = document.querySelector("#output");
  canvas.width = videoWidth;
  canvas.height = videoHeight;
  resetVideo();
  try {
  	localStorage.setItem("width", videoWidth);
    localStorage.setItem("height", videoHeight);
  } catch (e) {
  }
}

function onCodeChange(ev) {
	resetVideo();
}

function onLoadedFile(reader, ev) {
  let text = reader.result;
  let lines = text.split("\n");
  let filteredLines = [];
  lines.forEach(line => {
  	if (line.startsWith("//!width=")) {
    	document.querySelector("#width").value = line.substr(9);
    } else if (line.startsWith("//!height=")) {
    	document.querySelector("#height").value = line.substr(10);
    } else {
    	filteredLines.push(line);
    }
  });
  document.querySelector("#editor").value = filteredLines.join("\n");
  resetVideo();
}

function onLoad(ev) {
  let fileInput = document.querySelector("#load");
  if (fileInput.files.length < 1) return;
  let file = fileInput.files[0];
  let name = file.name;
  let basename = name.substr(0, name.lastIndexOf("."));
  document.querySelector("#title").value = basename;
  const reader = new FileReader();
  reader.addEventListener("load", onLoadedFile.bind(null, reader));
  reader.readAsText(file);
}

function onSave(ev) {
	let initial = "//!width=" + videoWidth + "\n//!height=" + videoHeight + "\n";
  let blob = new Blob([initial, document.querySelector("#editor").value], {type: "text/plain"});
  let url = URL.createObjectURL(blob);
  let a = document.createElement('a');
  a.href = url;
  a.download = document.querySelector("#title").value + ".pqs";
  a.click();
}

let lastContent = "";
function checkForChange(ev) {
	let content = document.querySelector("#editor").value;
  if (content != lastContent) {
    let translated = translateCode(content);
    try {
      let f = new async function() {}.constructor("set", "wait", translated);
      resetVideo();
      lastContent = content;
    } catch (e) {
    }  	
  }
}

function onTitleChange(ev) {
	try {
  	localStorage.setItem("title", document.querySelector("#title").value);
  } catch (e) {
  }
}

function onNew(ev) {
  let adjective = titleAdjectives[(Math.random() * titleAdjectives.length) | 0];
  let shape = titleShapes[(Math.random() * titleShapes.length) | 0];
  document.querySelector("#title").value = adjective + " " + shape;
  document.querySelector("#width").value = 32;
  document.querySelector("#height").value = 32;
  document.querySelector("#editor").value = "// Put your code here.\n// Use // to write comments that aren't executed.\n";
  onSizeChange();
  onTitleChange();
  resetVideo();
}

let renderWorker = null;
let renderFrame = 0;
let renderData = [];
let renderTime = 0;
// startRender, endRender, render, advance
function onRenderWorkerMessage(ev) {
	let data = ev.data;
  if (data.cmd == "render") {
  	if (renderData.length > renderFrame &&
        data.x >= 0 && data.x < videoWith &&
        data.y >= 0 && data.y < videoHeight) {
    	let offset = 3 * (data.x + videoWidth * data.y);
      renderData[renderFrame][offset] = data.r;
      renderData[renderFrame][offset + 1] = data.g;
      renderData[renderFrame][offset + 2] = data.b;
    }
  	setImpl(data.x, data.y, data.r, data.g, data.b);
  } else if (data.cmd == "advance") {
    renderTime += data.s;
    let newFrame = (renderTime * 60) | 0;
    while (renderFrame < newFrame) {
    	let newData = new Uint8Array(3 * videoWidth * videoHeight);
      for (let i = 0; i < 3 * videoWidth * videoHeight; ++i) {
      	newData[i] = renderData[renderFrame][i];
      }
      renderData.push(newData);
      renderFrame++;
      document.querySelector("#renderFrame").innerText = renderFrame;
    }
  } else if (data.cmd == "error") {
  	onCancel();
    document.querySelector("#error").innerText = "Error running code: " + data.str;
    document.querySelector("#output").style.display = "none";
    document.querySelector("#error").style.display = "block";
    console.log("Error running render code: " + data.str);
  } else if (data.cmd == "startRender") {
  	renderTime = 0;
    renderFrame = 0;
    renderData = [];
    renderData[0] = new Uint8Array(3 * videoWidth * videoHeight);
    document.querySelector("#renderFrame").innerText = renderFrame;
  } else if (data.cmd == "endRender") {
  	let size = new Uint8Array(2);
    size[0] = videoWidth;
    size[1] = videoHeight;
    renderData.unshift(size);
    let videoBlob = new Blob(renderData, {type: "application/octet-stream"});
    let videoUrl = URL.createObjectURL(videoBlob);
    let a = document.createElement("a");
    a.href = videoUrl;
    a.download = document.querySelector("#title").value + ".pqv";
    a.click();
    onCancel();
  }
}

function onRender(ev) {
  if (renderWorker) {
  	onCancel();
  }
  let rawCode = document.querySelector("#editor").value;
  let translated = translateCode(rawCode);
	try {
  	runCode = new async function() {}.constructor("set", "wait", translated);
  } catch (e) {
    return;
  }
  codeBlob = new Blob(
  	[renderWorkerCodeBefore, translated, renderWorkerCodeAfter],
    {type: "text/javascript"});
  let url = URL.createObjectURL(codeBlob);
  document.querySelector("#output").style.display = "none";
  document.querySelector("#error").style.display = "none";
  document.querySelector("#renderPanel").style.display = "block";
	document.querySelector("#renderFrame").innerText = renderFrame;
  renderWorker = new Worker(url);
  renderWorker.addEventListener("message", onRenderWorkerMessage);
}

function onCancel(ev) {
	if (renderWorker) {
  	renderWorker.removeEventListener("message", onRenderWorkerMessage);
  	renderWorker.terminate();
    renderWorker = null;
  }
  document.querySelector("#output").style.display = "block";
  document.querySelector("#error").style.display = "none";
  document.querySelector("#renderPanel").style.display = "none";
}

function init() {
	document.querySelector("#width").addEventListener("change", onSizeChange);
  document.querySelector("#height").addEventListener("change", onSizeChange);
  document.querySelector("#editor").addEventListener("change", onCodeChange);
  document.querySelector("#load").addEventListener("change", onLoad);
  document.querySelector("#save").addEventListener("click", onSave);
  document.querySelector("#title").addEventListener("change", onTitleChange);
  document.querySelector("#new").addEventListener("click", onNew);
  document.querySelector("#render").addEventListener("click", onRender);
  document.querySelector("#cancel").addEventListener("click", onCancel);
  let adjective = titleAdjectives[(Math.random() * titleAdjectives.length) | 0];
  let shape = titleShapes[(Math.random() * titleShapes.length) | 0];
  document.querySelector("#title").value = adjective + " " + shape;
  try {
  	let vw = localStorage.getItem("width");
    if (vw) videoWidth = vw;
    let vh = localStorage.getItem("height");
    if (vh) videoWith = vh;
    let code = localStorage.getItem("code");
    if (code) document.querySelector("#editor").value = code;
    let title = localStorage.getItem("title");
    if (title) document.querySelector("#title").value = title;
  } catch (e) {
  }
  onSizeChange();
  onTitleChange();
  setInterval(checkForChange, 5000);
}