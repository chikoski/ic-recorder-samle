navigator.getUserMedia =
  navigator.getUserMedia || navigator.mozGetUserMedia;

var recorder = null;
var stream = null;
var ui = {
  startButton: null,
  stopButton: null,
  indicator: null
};
var storage = null;

var visualizer = {
  graphicsContext: null,
  audioContext: null,
  sourceNode: null,
  analyser: null,
  buffer: null,
  canvas: null,
  get ready(){
    return this.graphicsContext != null &&
      this.audioContext != null &&
      this.sourceNode != null &&
      this.analyser != null &&
      this.buffer != null;
  },
  get volume(){
    this.analyser.getByteFrequencyData(this.buffer);
    return scale(average(this.buffer), 0, 255);
  }
};

function average(data){
  var result = 0;
  for(var i = 0; i < data.length; i++){
    result += data[i];
  }
  return result / data.length;
}

function scale(value, min, max){
  return Math.min(1, (value - min) / (max - min));
}

function toggleElementVisibility(elm){
  elm.classList.toggle("hidden");
}

function toggleRecordButtonState(){
  if(ui.startButton != null && ui.stopButton != null){
    toggleElementVisibility(ui.startButton);
    toggleElementVisibility(ui.stopButton);
  }
}

function formatDigit(digit){
  var text = "" + digit;
  if(-1 < digit && digit < 10){
    text = "0" + text;
  }
  return text;
}

function createFileName(){
  var now = new Date();
  return "captured-" + (1900 + now.getYear()) + "-" +
    formatDigit(now.getMonth()) + "-" +
    formatDigit(now.getDate()) + "-" +
    formatDigit(now.getHours()) + formatDigit(now.getMinutes()) + ".ogg";
}

function saveCapturedData(blob){
  if(storage != null){
    var req = storage.addNamed(blob, createFileName());
    req.onsuccess = function(){
      console.log(this.result + "に保存");
    };

    req.onerror = function(){
      console.log(this.error.name + ":" + this.error.message);
    };
  }
}

function initializeRecorder(){
  if(stream != null){
    console.log("MediaRecorder 初期化")
    recorder = new MediaRecorder(stream);

    recorder.addEventListener("start", function(event){
      toggleRecordButtonState();
    });

    recorder.addEventListener("stop", function(event){
      toggleRecordButtonState();
    });

    recorder.addEventListener("dataavailable", function(event){
      console.log("blob取得");
      saveCapturedData(event.data);
    });
  }
}

function initializeVisualizer(){
  if(stream != null && ui.indicator != null){
    var audioContext= new AudioContext();
    visualizer.sourceNode = audioContext.createMediaStreamSource(stream);

    visualizer.analyser = audioContext.createAnalyser();
    visualizer.analyser.fftSize = 32;
    visualizer.buffer = new Uint8Array(visualizer.analyser.frequencyBinCount);

    visualizer.sourceNode.connect(visualizer.analyser);

    visualizer.audioContext = audioContext;
    visualizer.canvas = ui.indicator;
    visualizer.graphicsContext = visualizer.canvas.getContext("2d");

    update();
  }
}

function doUpdateVisualizer(){
  var gc = visualizer.graphicsContext;
  gc.fillStyle = "white";
  gc.fillRect(0, 0,
              visualizer.canvas.width,
              visualizer.canvas.height);
  var h = visualizer.volume * visualizer.canvas.height;
  gc.fillStyle = "green";
  gc.fillRect(0, visualizer.canvas.height - h,
              visualizer.canvas.width,
              h);
}

function updateVisualizer(){
  if(visualizer.ready){
    doUpdateVisualizer();
  }
}

function update(){
  updateVisualizer();
  requestAnimationFrame(update);
}

function initializeStorage(){
  storage = navigator.getDeviceStorage("music");
}

function initializeAudioStream(){
  navigator.getUserMedia({video: false, audio:true},
    function(_stream){
      console.log("ストリーム取得")
      stream = _stream;
      initializeRecorder();
      initializeVisualizer();
      ui.startButton.disabled = false;
    }, function(error){
      console.log(error);
    });
}

window.addEventListener("load", function() {
  console.log("アプリ起動");

  ui.startButton = document.querySelector("#start");
  ui.stopButton = document.querySelector("#stop");
  ui.indicator = document.querySelector("#indicator");
  ui.indicator.height = window.innerHeight;
  ui.indicator.width = window.innerWidth;

  toggleElementVisibility(ui.stopButton);
  ui.startButton.disabled = true;

  ui.startButton.addEventListener("click", function(event){
    if(recorder != null){
      console.log("録音開始");
      recorder.start();
    }
  });

  ui.stopButton.addEventListener("click", function(event){
    if(recorder != null){
      console.log("録音終了");
      recorder.stop();
    }
  });

  initializeStorage();
  initializeAudioStream();
});
window.addEventListener("beforeunload", function(){
  console.log("アプリ終了");
  if(stream != null){
    console.log("ストリーム停止");
    stream.stop();
    stream = null;
  }
});
