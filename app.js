/* =========================================================
   AIR GUITAR OPERA
   CAMERA VISIBILITY + PERFORMANCE FIX

   Design unchanged
   Acoustic guitar unchanged
   Guitar Concert unchanged

   Main corrections:
   - Camera remains visible
   - Faster MediaPipe tracking
   - No simultaneous MediaPipe processing
   - Fewer particles for better performance
   - Lower camera resolution
   ========================================================= */


/* =========================================================
   HTML ELEMENTS
========================================================= */

const el = (id) => document.getElementById(id);

const welcome = el("welcome");
const stage = el("stage");

const startBtn = el("startBtn");
const startMsg = el("startMsg");

const video = el("video");

const fxCanvas = el("fx");
const handsCanvas = el("handsCanvas");

const fx = fxCanvas.getContext("2d");
const hc = handsCanvas.getContext("2d");

const leftField = el("leftField");
const rightField = el("rightField");

const chordName = el("chordName");
const chordLong = el("chordLong");
const playedNote = el("playedNote");

const leftEnergy = el("leftEnergy");
const rightEnergy = el("rightEnergy");

const cameraState = el("cameraState");
const handState = el("handState");

const message = el("message");
const subMessage = el("subMessage");

const progressBar = el("progressBar");

const manualBtn = el("manualBtn");
const concertBtn = el("concertBtn");
const pauseBtn = el("pauseBtn");

const volume = el("volume");
const volumeText = el("volumeText");

const errorBox = el("error");


/* =========================================================
   GLOBAL STATE
========================================================= */

let camera = null;
let hands = null;

let audioCtx = null;
let player = null;
let output = null;
let instrumentReady = false;

let mode = "manual";

let concertTimer = null;
let concertPaused = false;
let concertStep = 0;

let selectedChord = 0;

let lastHandSeen = 0;

let lastRight = null;
let lastRightTime = 0;
let lastPlay = 0;

let leftIn = false;
let rightIn = false;

let leftPower = 0;
let rightPower = 0;

let particles = [];

let mediaPipeBusy = false;
let lastMediaPipeFrame = 0;

let animationStarted = false;


/* =========================================================
   DETECTION ZONES

   Left field:
   Small chord-selection field

   Right field:
   Large guitar-performance field
========================================================= */

const LEFT = {
  x1: 0.05,
  x2: 0.25,
  y1: 0.32,
  y2: 0.80
};

const RIGHT = {
  x1: 0.42,
  x2: 0.96,
  y1: 0.17,
  y2: 0.90
};


/* =========================================================
   GUITAR MUSICAL DATA
========================================================= */

const CHORDS = [
  {
    n: "C MAJOR",
    s: "C",
    m: [48, 52, 55, 60, 64]
  },
  {
    n: "A MINOR",
    s: "Am",
    m: [45, 48, 52, 57, 60]
  },
  {
    n: "F MAJOR",
    s: "F",
    m: [41, 45, 48, 53, 57]
  },
  {
    n: "G MAJOR",
    s: "G",
    m: [43, 47, 50, 55, 59]
  }
];

const MELODY = [
  60,
  62,
  64,
  67,
  69,
  72,
  74,
  76,
  79
];

const PROGRESSION = [
  0,
  1,
  2,
  3,
  0,
  3,
  1,
  2
];


/* =========================================================
   ACOUSTIC GUITAR ENGINE
========================================================= */

function initInstrument() {
  if (instrumentReady) {
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    return true;
  }

  if (
    typeof WebAudioFontPlayer !== "function" ||
    typeof _tone_0250_LK_AcousticSteel_SF2_file === "undefined"
  ) {
    showError(
      "The acoustic-guitar library did not load. Check the Internet connection."
    );

    return false;
  }

  audioCtx = new (
    window.AudioContext ||
    window.webkitAudioContext
  )();

  player = new WebAudioFontPlayer();

  output = audioCtx.createGain();
  output.gain.value = Number(volume.value);
  output.connect(audioCtx.destination);

  player.loader.decodeAfterLoading(
    audioCtx,
    "_tone_0250_LK_AcousticSteel_SF2_file"
  );

  instrumentReady = true;

  return true;
}


/* =========================================================
   PLAY ONE GUITAR NOTE
========================================================= */

function note(
  midi,
  velocity = 0.7,
  delay = 0,
  duration = 1.8
) {
  if (!initInstrument()) {
    return;
  }

  player.queueWaveTable(
    audioCtx,
    output,
    _tone_0250_LK_AcousticSteel_SF2_file,
    audioCtx.currentTime + delay,
    midi,
    duration,
    Math.min(0.95, velocity)
  );
}


/* =========================================================
   STRUM A COMPLETE CHORD
========================================================= */

function strum(
  chordIndex = selectedChord,
  velocity = 0.75,
  upward = false
) {
  const chord = CHORDS[chordIndex];

  const notes = upward
    ? [...chord.m].reverse()
    : chord.m;

  notes.forEach((midi, index) => {
    const stringDelay =
      index * (
        0.026 +
        (1 - velocity) * 0.018
      );

    note(
      midi,
      velocity,
      stringDelay,
      2
    );
  });

  selectedChord = chordIndex;

  chordName.textContent =
    chord.s;

  chordLong.textContent =
    chord.n;

  burst(
    innerWidth * 0.72,
    innerHeight * 0.48,
    "#ffd36b",
    18
  );
}


/* =========================================================
   STOP ALL AUDIO
========================================================= */

function stopSound() {
  if (player && audioCtx) {
    player.cancelQueue(audioCtx);
  }
}


/* =========================================================
   GUITAR CONCERT MODE
========================================================= */

function playConcertBeat() {
  if (
    mode !== "concert" ||
    concertPaused
  ) {
    return;
  }

  const chordIndex =
    PROGRESSION[
      concertStep %
      PROGRESSION.length
    ];

  strum(
    chordIndex,
    0.72,
    concertStep % 2 === 1
  );

  window.setTimeout(() => {
    note(
      MELODY[
        (concertStep * 2) %
        MELODY.length
      ],
      0.42,
      0,
      1.35
    );
  }, 270);

  window.setTimeout(() => {
    note(
      MELODY[
        (concertStep * 2 + 2) %
        MELODY.length
      ],
      0.36,
      0,
      1.1
    );
  }, 560);

  concertStep += 1;

  progressBar.style.width =
    `${
      (
        concertStep %
        PROGRESSION.length
      ) /
      PROGRESSION.length *
      100
    }%`;

  message.textContent =
    "Guitar Concert is playing";

  subMessage.textContent =
    "Your right hand can improvise above the acoustic guitar arrangement";
}


function startConcert() {
  mode = "concert";

  manualBtn.classList.remove("active");
  concertBtn.classList.add("active");

  concertPaused = false;

  pauseBtn.textContent =
    "PAUSE";

  window.clearInterval(
    concertTimer
  );

  playConcertBeat();

  concertTimer =
    window.setInterval(
      playConcertBeat,
      900
    );
}


/* =========================================================
   MANUAL MODE
========================================================= */

function setManual() {
  mode = "manual";

  manualBtn.classList.add("active");
  concertBtn.classList.remove("active");

  window.clearInterval(
    concertTimer
  );

  concertTimer = null;
  concertPaused = false;

  pauseBtn.textContent =
    "PAUSE";

  progressBar.style.width =
    "0%";

  stopSound();

  message.textContent =
    "Manual Live mode";

  subMessage.textContent =
    "Left hand selects the chord. Right hand performs the acoustic guitar.";
}


/* =========================================================
   PAUSE OR RESUME CONCERT
========================================================= */

function togglePause() {
  if (mode !== "concert") {
    return;
  }

  concertPaused =
    !concertPaused;

  pauseBtn.textContent =
    concertPaused
      ? "RESUME"
      : "PAUSE";

  if (concertPaused) {
    window.clearInterval(
      concertTimer
    );

    concertTimer = null;

    stopSound();
  } else {
    playConcertBeat();

    concertTimer =
      window.setInterval(
        playConcertBeat,
        900
      );
  }
}


/* =========================================================
   CANVAS RESOLUTION

   Resolution is limited to 1.5x to reduce GPU load.
========================================================= */

function resize() {
  const pixelRatio =
    Math.min(
      window.devicePixelRatio || 1,
      1.5
    );

  [
    fxCanvas,
    handsCanvas
  ].forEach((canvas) => {
    canvas.width =
      Math.round(
        innerWidth *
        pixelRatio
      );

    canvas.height =
      Math.round(
        innerHeight *
        pixelRatio
      );

    canvas.style.width =
      `${innerWidth}px`;

    canvas.style.height =
      `${innerHeight}px`;

    canvas
      .getContext("2d")
      .setTransform(
        pixelRatio,
        0,
        0,
        pixelRatio,
        0,
        0
      );
  });
}


/* =========================================================
   PARTICLES
========================================================= */

function burst(
  x,
  y,
  color,
  amount = 5
) {
  for (
    let index = 0;
    index < amount;
    index += 1
  ) {
    particles.push({
      x,
      y,

      vx:
        (Math.random() - 0.5) *
        4.2,

      vy:
        (Math.random() - 0.5) *
        4.2,

      life: 1,

      size:
        Math.random() *
        3.4 + 1,

      color
    });
  }

  /*
    Important performance limit.
  */

  if (particles.length > 260) {
    particles.splice(
      0,
      particles.length - 260
    );
  }
}


/* =========================================================
   PARTICLE ANIMATION

   IMPORTANT CAMERA FIX:

   clearRect() removes the old particles without painting
   a dark rectangle over the camera.

   The previous version used a translucent black fill.
   That black color accumulated until the camera became
   almost completely invisible.
========================================================= */

function animate() {
  fx.clearRect(
    0,
    0,
    innerWidth,
    innerHeight
  );

  for (const particle of particles) {
    particle.x += particle.vx;
    particle.y += particle.vy;

    particle.vx *= 0.98;
    particle.vy *= 0.98;

    particle.life -= 0.025;

    fx.globalAlpha =
      Math.max(
        0,
        particle.life
      );

    fx.fillStyle =
      particle.color;

    fx.beginPath();

    fx.arc(
      particle.x,
      particle.y,
      particle.size,
      0,
      Math.PI * 2
    );

    fx.fill();
  }

  fx.globalAlpha = 1;

  particles =
    particles.filter(
      (particle) =>
        particle.life > 0
    );

  window.requestAnimationFrame(
    animate
  );
}


/* =========================================================
   LANDMARK UTILITIES
========================================================= */

function pointFromLandmark(
  landmark
) {
  return {
    /*
      X is mirrored because the video
      is displayed like a mirror.
    */

    x:
      1 - landmark.x,

    y:
      landmark.y,

    screenX:
      (
        1 - landmark.x
      ) *
      innerWidth,

    screenY:
      landmark.y *
      innerHeight
  };
}


function pointInsideZone(
  point,
  zone
) {
  return (
    point &&
    point.x >= zone.x1 &&
    point.x <= zone.x2 &&
    point.y >= zone.y1 &&
    point.y <= zone.y2
  );
}


/* =========================================================
   DRAW HAND LANDMARKS
========================================================= */

function drawHand(
  landmarks,
  color
) {
  const connections = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],

    [0, 5],
    [5, 6],
    [6, 7],
    [7, 8],

    [5, 9],
    [9, 10],
    [10, 11],
    [11, 12],

    [9, 13],
    [13, 14],
    [14, 15],
    [15, 16],

    [13, 17],
    [17, 18],
    [18, 19],
    [19, 20],

    [0, 17]
  ];

  hc.save();

  hc.strokeStyle = color;
  hc.fillStyle = "#ffffff";

  hc.lineWidth = 2;

  /*
    Lower shadow value improves performance.
  */

  hc.shadowBlur = 7;
  hc.shadowColor = color;

  for (
    const [
      startIndex,
      endIndex
    ] of connections
  ) {
    const startPoint =
      pointFromLandmark(
        landmarks[startIndex]
      );

    const endPoint =
      pointFromLandmark(
        landmarks[endIndex]
      );

    hc.beginPath();

    hc.moveTo(
      startPoint.screenX,
      startPoint.screenY
    );

    hc.lineTo(
      endPoint.screenX,
      endPoint.screenY
    );

    hc.stroke();
  }

  for (const landmark of landmarks) {
    const point =
      pointFromLandmark(
        landmark
      );

    hc.beginPath();

    hc.arc(
      point.screenX,
      point.screenY,
      3.2,
      0,
      Math.PI * 2
    );

    hc.fill();
  }

  hc.restore();
}


/* =========================================================
   UPDATE HAND INTERACTION
========================================================= */

function updateInteraction(
  leftPoint,
  rightPoint
) {
  const leftControlPoint =
    pointInsideZone(
      leftPoint,
      LEFT
    )
      ? leftPoint
      : pointInsideZone(
          rightPoint,
          LEFT
        )
        ? rightPoint
        : null;

  const rightPerformancePoint =
    pointInsideZone(
      rightPoint,
      RIGHT
    )
      ? rightPoint
      : pointInsideZone(
          leftPoint,
          RIGHT
        )
        ? leftPoint
        : null;


  leftIn =
    Boolean(
      leftControlPoint
    );

  rightIn =
    Boolean(
      rightPerformancePoint
    );


  /* LEFT-HAND CHORD CONTROL */

  if (leftControlPoint) {
    const relativeY =
      Math.max(
        0,
        Math.min(
          0.999,

          (
            leftControlPoint.y -
            LEFT.y1
          ) /
          (
            LEFT.y2 -
            LEFT.y1
          )
        )
      );

    const chordIndex =
      Math.floor(
        relativeY * 4
      );

    if (
      chordIndex !==
      selectedChord
    ) {
      selectedChord =
        chordIndex;

      chordName.textContent =
        CHORDS[chordIndex].s;

      chordLong.textContent =
        CHORDS[chordIndex].n;

      note(
        CHORDS[
          chordIndex
        ].m[0],

        0.34,
        0,
        1.2
      );

      burst(
        leftControlPoint.screenX,
        leftControlPoint.screenY,
        "#59ecff",
        8
      );
    }

    leftPower =
      Math.min(
        100,
        leftPower + 9
      );

    /*
      Create fewer particles.
    */

    if (Math.random() < 0.35) {
      burst(
        leftControlPoint.screenX,
        leftControlPoint.screenY,
        "#59ecff",
        1
      );
    }
  } else {
    leftPower =
      Math.max(
        0,
        leftPower - 13
      );
  }


  /* RIGHT-HAND PERFORMANCE */

  if (rightPerformancePoint) {
    if (lastRight) {
      const now =
        performance.now();

      const deltaX =
        rightPerformancePoint.x -
        lastRight.x;

      const deltaY =
        rightPerformancePoint.y -
        lastRight.y;

      const elapsed =
        Math.max(
          16,
          now - lastRightTime
        );

      const speed =
        Math.hypot(
          deltaX,
          deltaY
        ) /
        elapsed *
        1000;


      /* FAST MOVEMENT: CHORD STRUM */

      if (
        speed > 0.31 &&
        now - lastPlay > 135
      ) {
        strum(
          selectedChord,

          Math.min(
            0.92,
            Math.max(
              0.4,
              speed * 0.72
            )
          ),

          deltaY < 0
        );

        playedNote.textContent =
          "STRUM";

        lastPlay = now;
      }


      /* GENTLE MOVEMENT: SINGLE NOTE */

      else if (
        speed > 0.095 &&
        speed <= 0.31 &&
        now - lastPlay > 190
      ) {
        const melodyIndex =
          Math.max(
            0,
            Math.min(
              MELODY.length - 1,

              Math.floor(
                (
                  1 -
                  rightPerformancePoint.y
                ) *
                MELODY.length
              )
            )
          );

        note(
          MELODY[melodyIndex],

          Math.min(
            0.62,
            Math.max(
              0.3,
              speed + 0.25
            )
          ),

          0,
          1.4
        );

        playedNote.textContent =
          "LIVE NOTE";

        lastPlay = now;
      }


      rightPower =
        Math.min(
          100,
          speed * 118
        );


      /*
        Reduced particle generation.
      */

      if (Math.random() < 0.45) {
        burst(
          rightPerformancePoint.screenX,
          rightPerformancePoint.screenY,
          "#f15ee8",

          Math.max(
            1,
            Math.floor(
              speed * 5
            )
          )
        );
      }
    }

    lastRight = {
      x:
        rightPerformancePoint.x,

      y:
        rightPerformancePoint.y
    };

    lastRightTime =
      performance.now();

  } else {
    lastRight = null;
    lastRightTime = 0;

    rightPower =
      Math.max(
        0,
        rightPower - 16
      );

    playedNote.textContent =
      mode === "concert"
        ? "Add live notes"
        : "Move to play";
  }


  /* INTERFACE */

  leftField.classList.toggle(
    "active",
    leftIn
  );

  rightField.classList.toggle(
    "active",
    rightIn
  );

  leftEnergy.style.width =
    `${leftPower}%`;

  rightEnergy.style.width =
    `${rightPower}%`;


  if (mode === "manual") {
    if (leftIn && rightIn) {
      message.textContent =
        "Harmony selected. Perform with the right hand.";

      subMessage.textContent =
        "Fast movement strums. Gentle movement plays individual guitar notes.";
    }

    else if (leftIn) {
      message.textContent =
        "Choose a chord with the left hand";

      subMessage.textContent =
        "Move vertically through C, Am, F and G";
    }

    else if (rightIn) {
      message.textContent =
        "Right hand is performing";

      subMessage.textContent =
        "Move faster for a stronger acoustic strum";
    }

    else {
      message.textContent =
        "Place your left hand inside the chord field";

      subMessage.textContent =
        "Then move the right hand inside the guitar field";
    }
  }
}


/* =========================================================
   MEDIAPIPE RESULTS
========================================================= */

function onResults(results) {
  hc.clearRect(
    0,
    0,
    innerWidth,
    innerHeight
  );

  const detectedHands =
    results.multiHandLandmarks ||
    [];

  const handedness =
    results.multiHandedness ||
    [];


  if (
    detectedHands.length === 0
  ) {
    handState.textContent =
      "NO HANDS";

    if (
      performance.now() -
      lastHandSeen >
      220
    ) {
      leftIn = false;
      rightIn = false;

      leftField.classList.remove(
        "active"
      );

      rightField.classList.remove(
        "active"
      );

      leftEnergy.style.width =
        "0%";

      rightEnergy.style.width =
        "0%";

      lastRight = null;
    }

    return;
  }


  lastHandSeen =
    performance.now();

  handState.textContent =
    `${detectedHands.length} HAND${
      detectedHands.length > 1
        ? "S"
        : ""
    }`;


  let leftPoint = null;
  let rightPoint = null;


  detectedHands.forEach(
    (
      landmarks,
      index
    ) => {
      const classification =
        handedness[index];

      const label =
        classification?.label ||
        (
          index
            ? "Right"
            : "Left"
        );

      const color =
        label === "Left"
          ? "#59ecff"
          : "#f15ee8";

      drawHand(
        landmarks,
        color
      );

      /*
        Landmark 9 represents the
        approximate palm center.
      */

      const palmPoint =
        pointFromLandmark(
          landmarks[9]
        );

      if (label === "Left") {
        leftPoint =
          palmPoint;
      } else {
        rightPoint =
          palmPoint;
      }
    }
  );


  updateInteraction(
    leftPoint,
    rightPoint
  );
}


/* =========================================================
   MEDIAPIPE INITIALIZATION

   Complexity 0 is faster and sufficiently accurate
   for detecting the palm position.
========================================================= */

function initHands() {
  hands = new Hands({
    locateFile: (fileName) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${fileName}`
  });

  hands.setOptions({
    maxNumHands: 2,

    modelComplexity: 0,

    minDetectionConfidence:
      0.55,

    minTrackingConfidence:
      0.52,

    selfieMode: true
  });

  hands.onResults(
    onResults
  );
}


/* =========================================================
   FRAME THROTTLING

   Prevents simultaneous MediaPipe calls.
   Maximum approximately 30 analyses per second.
========================================================= */

async function sendFrame() {
  const now =
    performance.now();

  if (
    mediaPipeBusy ||
    now - lastMediaPipeFrame < 33 ||
    !hands ||
    video.readyState < 2
  ) {
    return;
  }

  mediaPipeBusy = true;
  lastMediaPipeFrame = now;

  try {
    await hands.send({
      image: video
    });
  } catch (error) {
    console.warn(
      "MediaPipe frame skipped",
      error
    );
  } finally {
    mediaPipeBusy = false;
  }
}


/* =========================================================
   START CAMERA

   Uses 960 x 540 instead of 1280 x 720
   for lower latency.
========================================================= */

async function startExperience() {
  startBtn.disabled = true;

  startMsg.textContent =
    "Loading the acoustic guitar and requesting camera permission...";

  try {
    if (!initInstrument()) {
      throw new Error(
        "Acoustic guitar samples did not load."
      );
    }

    initHands();

    camera = new Camera(video, {
      onFrame: sendFrame,

      width: 960,
      height: 540
    });

    await camera.start();

    /*
      Force the video to be visible.
    */

    video.style.display =
      "block";

    video.style.opacity =
      "1";

    welcome.classList.add(
      "hidden"
    );

    stage.classList.remove(
      "hidden"
    );

    cameraState.textContent =
      "CAMERA ACTIVE";

    resize();

    if (!animationStarted) {
      animationStarted = true;
      animate();
    }

  } catch (error) {
    console.error(error);

    startBtn.disabled = false;

    startMsg.textContent =
      error.message;

    showError(
      error.message
    );
  }
}


/* =========================================================
   RESTART CAMERA
========================================================= */

async function restartCamera() {
  stopSound();

  cameraState.textContent =
    "RESTARTING";

  try {
    if (camera) {
      await camera.stop();
    }

    if (video.srcObject) {
      video.srcObject
        .getTracks()
        .forEach(
          (track) =>
            track.stop()
        );
    }

    camera = new Camera(video, {
      onFrame: sendFrame,

      width: 960,
      height: 540
    });

    await camera.start();

    video.style.display =
      "block";

    video.style.opacity =
      "1";

    cameraState.textContent =
      "CAMERA ACTIVE";

  } catch (error) {
    showError(
      "Unable to restart camera"
    );
  }
}


/* =========================================================
   ERROR MESSAGE
========================================================= */

function showError(text) {
  errorBox.textContent =
    text;

  errorBox.classList.remove(
    "hidden"
  );

  window.setTimeout(() => {
    errorBox.classList.add(
      "hidden"
    );
  }, 6000);
}


/* =========================================================
   EVENTS
========================================================= */

startBtn.onclick =
  startExperience;

manualBtn.onclick =
  setManual;

concertBtn.onclick =
  startConcert;

pauseBtn.onclick =
  togglePause;


el("stopBtn").onclick = () => {
  window.clearInterval(
    concertTimer
  );

  concertTimer = null;
  concertPaused = true;

  pauseBtn.textContent =
    "RESUME";

  stopSound();
};


el("restartBtn").onclick =
  restartCamera;


el("fullBtn").onclick = () => {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    document
      .documentElement
      .requestFullscreen();
  }
};


volume.oninput = () => {
  const newVolume =
    Number(
      volume.value
    );

  volumeText.textContent =
    `${Math.round(
      newVolume * 100
    )}%`;

  if (
    output &&
    audioCtx
  ) {
    output.gain.setTargetAtTime(
      newVolume,
      audioCtx.currentTime,
      0.02
    );
  }
};


document.addEventListener(
  "visibilitychange",
  () => {
    if (document.hidden) {
      stopSound();
    }
  }
);


window.addEventListener(
  "blur",
  stopSound
);


window.addEventListener(
  "resize",
  resize
);


/* =========================================================
   INITIAL RESIZE
========================================================= */

resize();
