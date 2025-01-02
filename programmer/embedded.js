class Editor {
  eTextArea = null;
  eCanvas = null;
  context = null;
  eInitialCode = null;
  eErrorPane = null;
  videoWidth = 8;
  videoHeight = 8;
  worker = null;
  codeBlob = null;
  currentData = null;
  boundOnWorkerMesssage;
  constructor(elem) {
  	elem.style.whiteSpace = "pre";
  	this.eInitialCode = elem.innerText;
    if (this.eInitialCode.startsWith("\n")) this.eInitialCode = this.eInitialCode.substr(1);
    if (elem.getAttribute("width")) this.videoWidth = elem.getAttribute("width") | 0;
    if (elem.getAttribute("height")) this.videoHeight = elem.getAttribute("height") | 0;
    elem.innerHTML = "";
    let d = document.createElement("div");
    d.className = "editor";
    elem.appendChild(d);
    let b = document.createElement("button");
    b.innerText = "Reset";
    b.addEventListener("click", ev => {
    	this.eTextArea.value = this.eInitialCode;
    });
    d.appendChild(b);
    this.eTextArea = document.createElement("textarea");
    d.appendChild(this.eTextArea);
    this.eTextArea.value = this.eInitialCode;
    this.eTextArea.addEventListener("change", this.onCodeChange.bind(this));
    d = document.createElement("div");
    d.className = "output";
    elem.appendChild(d);
    this.eCanvas = document.createElement("canvas");
    this.context = this.eCanvas.getContext("2d");
    d.appendChild(this.eCanvas);
    this.eErrorPane = document.createElement("div");
    this.eErrorPane.className = "error";
    d.appendChild(this.eErrorPane);
    this.boundOnWorkerMessage = this.onWorkerMessage.bind(this);
	  this.onSizeChange();
    this.onCodeChange();
  	setInterval(this.checkForChange.bind(this), 5000);
  }
  
  static workerCodeBefore = "\n\
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

  static workerCodeAfter= "\n\
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

  clampint(x) {
    x = x | 0;
    if (x < 0) return 0;
    if (x > 255) return 255;
    return x;
  }

  setImpl(x, y, r, g, b) {
    if (x >= 0 && x < this.videoWidth && y >= 0 && y < this.videoHeight && this.currentData) {
      let offset = 4 * ((x | 0) + this.videoWidth * (y | 0));
      this.currentData.data[offset] = this.clampint(r);
      this.currentData.data[offset + 1] = this.clampint(g);
      this.currentData.data[offset + 2] = this.clampint(b);
    }
  }

  onWorkerMessage(ev) {
    let data = ev.data;
    if (data.cmd == "set") {
      this.setImpl(data.x, data.y, data.r, data.g, data.b);
    } else if (data.cmd == "draw") {
      if (this.currentData) {
        this.context.putImageData(this.currentData, 0, 0);
      }
    } else if (data.cmd == "error") {
    	this.eErrorPane.innerText = "Error running code: " + data.str;
      this.eCanvas.style.display = "none";
      this.eErrorPane.style.display = "block";
    } else if (data.cmd == "start") {
      this.eCanvas.style.display = "block";
      this.eErrorPane.style.display = "none";
      if (this.currentData) {
        this.context.putImageData(this.currentData, 0, 0);
      }
      this.currentData = this.context.createImageData(this.videoWidth, this.videoHeight);
      for (let i = 0; i < 4 * this.videoWidth * this.videoHeight; ++i) {
        this.currentData.data[i] = (i % 4 == 3) ? 255 : 0;
      }
    }
  }

  translateCode(code) {
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

  resetVideo() {
    if (this.worker) {
      this.worker.removeEventListener("message", this.boundOnWorkerMessage);
      this.worker.terminate();
      this.worker = null;
    }
    let rawCode = this.eTextArea.value;
    let translated = this.translateCode(rawCode);
    try {
      let runCode = new async function() {}.constructor("set", "wait", translated);
    } catch (e) {
      this.eErrorPane.innerText = "Could not parse code: " + e;
      this.eCanvas.style.display = "none";
      this.eErrorPane.style.display = "block";
      return;
    }
    this.codeBlob = new Blob(
      [Editor.workerCodeBefore, translated, Editor.workerCodeAfter],
      {type: "text/javascript"});
    let url = URL.createObjectURL(this.codeBlob);
    this.worker = new Worker(url);
    this.worker.addEventListener("message", this.boundOnWorkerMessage);
    this.eCanvas.style.display = "block";
    this.eErrorPane.style.display = "none";
  }

  onSizeChange(ev) {
    this.eCanvas.width = this.videoWidth;
    this.eCanvas.height = this.videoHeight;
  }

  onCodeChange(ev) {
    this.resetVideo();
  }

  lastContent = "";
  checkForChange(ev) {
    let content = this.eTextArea.value;
    if (content != this.lastContent) {
      let translated = this.translateCode(content);
      try {
        let f = new async function() {}.constructor("set", "wait", translated);
        this.resetVideo();
        this.lastContent = content;
      } catch (e) {
      }  	
    }
  }
}

document.querySelectorAll("editor").forEach(editorElem => {
	new Editor(editorElem);
});