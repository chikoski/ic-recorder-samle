navigator.getUserMedia =
  navigator.getUserMedia || navigator.mozGetUserMedia;

var recorder = null; // MediaRecorderオブジェクトへの参照
var stream = null; // マイクからの音声ストリームへの参照
// UI パーツへの参照
var ui = {
  startButton: null,
  stopButton: null,
  indicator: null
};
var storage = null; // DeviceStorageへの山椒う

// ボリュームの可視化を行うオブジェクト
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
    return scale(average(this.buffer), 0, 128);
  }
};

/**
 * データ群の平均値を返す関数
 * @param  {Array<Number>} data 数値データの入った配列
 * @return {Number}      平均値
 */
function average(data){
  var result = 0;
  for(var i = 0; i < data.length; i++){
    result += data[i];
  }
  return result / data.length;
}

/**
 * 数値のスケール変換を行う関数
 * @param  {Number} value 変換対象の数値
 * @param  {Number} min   変換後の最小値
 * @param  {Number} max   変換後の最大値
 * @return {Number}       変換後の数値
 */
function scale(value, min, max){
  return Math.min(1, (value - min) / (max - min));
}

/**
 * 引数に指定した要素の可視 / 不可視を切り替える関数
 * @param  {HTMLElement} elm 可視/不可視を切り替える対象のHTML要素
 * @return {null}
 */
function toggleElementVisibility(elm){
  elm.classList.toggle("hidden");
}

/**
 * 録音 / 録音停止 ボタンの切り替えを行う関数
 * @return {null}
 */
function toggleRecordButtonState(){
  if(ui.startButton != null && ui.stopButton != null){
    toggleElementVisibility(ui.startButton);
    toggleElementVisibility(ui.stopButton);
  }
}

/**
 * %02d として整形する関数
 * @param  {Number} digit 整形される数字
 * @return {String}       整形後の文字列
 */
function formatDigit(digit){
  var text = "" + digit;
  if(-1 < digit && digit < 10){
    text = "0" + text;
  }
  return text;
}

/**
 * 現在時刻からファイル名を作成する関数
 * @return {String} 作成されたファイル名
 */
function createFileName(){
  var now = new Date();
  return "captured-" + (1900 + now.getYear()) + "-" +
    formatDigit(now.getMonth()) + "-" +
    formatDigit(now.getDate()) + "-" +
    formatDigit(now.getHours()) + formatDigit(now.getMinutes()) + ".ogg";
}

/**
 * 録音データの入ったblobをファイルとして保存する関数
 * @param  {Blob} blob 録音データの入ったBlob
 * @return {null}
 */
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

/**
 * MediaRecorderオブジェクトの初期化とハンドラの登録
 * @return {null}
 */
function initializeRecorder(){
  if(stream != null){
    console.log("MediaRecorder 初期化")
    recorder = new MediaRecorder(stream);

    recorder.addEventListener("stop", function(event){
      toggleRecordButtonState();
    });

    recorder.addEventListener("dataavailable", function(event){
      console.log("blob取得");
      saveCapturedData(event.data);
    });
  }
}

/**
 * 音量の可視化オブジェクトの初期化。AudioNodeの作成と、描画コンテキストの取得を行う
 * @return {null}
 */
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

/**
 * 音量表示の更新処理。AnalyserNodeの分析結果をもとに棒グラフを描画
 * @return {null}
 */
function doUpdateVisualizer(){
}

/**
 * 音量表示の更新処理（エントリーポイント）
 * @return {null}
 */
function updateVisualizer(){
  if(visualizer.ready){
    doUpdateVisualizer();
  }
}

/**
 * 1フレームごとの画面更新処理
 * @return {null}
 */
function update(){
  updateVisualizer();
  requestAnimationFrame(update);
}

/**
 * デバイスストレージの初期化
 * @return {null}
 */
function initializeStorage(){
  storage = navigator.getDeviceStorage("music");
}

/**
 * マイクからの音声ストリームの初期化
 * @return {null}
 */
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

// アプリ起動時の処理
window.addEventListener("load", function() {
  console.log("アプリ起動");

  // UIを構成するHTML要素を取得
  ui.startButton = document.querySelector("#start");
  ui.stopButton = document.querySelector("#stop");
  ui.indicator = document.querySelector("#indicator");
  ui.indicator.height = window.innerHeight;
  ui.indicator.width = window.innerWidth;

  toggleElementVisibility(ui.stopButton);
  ui.startButton.disabled = true;

  // 録音ボタンが押されたときの処理
  ui.startButton.addEventListener("click", function(event){
    if(recorder != null){
      console.log("録音開始");
      toggleRecordButtonState();
      recorder.start();
    }
  });

  // 録音停止ボタンが押されたときの処理
  ui.stopButton.addEventListener("click", function(event){
    if(recorder != null){
      console.log("録音終了");
      recorder.stop();
    }
  });

  initializeStorage();
  initializeAudioStream();
});

// アプリ終了時の処理
window.addEventListener("beforeunload", function(){
  console.log("アプリ終了");
  if(stream != null){
    console.log("ストリーム停止");
    stream.stop();
    stream = null;
  }
});
