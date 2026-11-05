/* =========================================================
   AIR GUITAR OPERA

   Fixes included:
   - No mirrored camera
   - Correct real left and right hands
   - Lower latency
   - MediaPipe frame throttling
   - No simultaneous MediaPipe processing
   - Smooth but responsive movement
   - Camera remains visible
   - Original design preserved
   - Acoustic-guitar engine preserved
   ========================================================= */


/* =========================================================
   HTML ELEMENTS
========================================================= */

const el = (id) =>
  document.getElementById(id);

const welcome =
  el("welcome");

const stage =
  el("stage");

const startBtn =
  el("startBtn");

const startMsg =
  el("startMsg");

const video =
  el("video");

const fxCanvas =
  el("fx");

const handsCanvas =
  el("handsCanvas");

const fx =
  fxCanvas.getContext("2d");

const hc =
  handsCanvas.getContext("2d");

const leftField =
  el("leftField");

const rightField =
  el("rightField");

const chordName =
  el("chordName");

const chordLong =
  el("chordLong");

const playedNote =
  el("playedNote");

const leftEnergy =
  el("leftEnergy");

const rightEnergy =
  el("rightEnergy");

const cameraState =
  el("cameraState");

const handState =
  el("handState");

const message =
  el("message");

const subMessage =
  el("subMessage");

const progressBar =
  el("progressBar");

const manualBtn =
  el("manualBtn");

const concertBtn =
  el("concertBtn");

const pauseBtn =
  el("pauseBtn");

const volume =
  el("volume");

const volumeText =
  el("volumeText");

const errorBox =
  el("error");


/* =========================================================
   STATE
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

let smoothLeftPoint = null;
let smoothRightPoint = null;


/*
  Higher value:
  more responsive, less smoothing.

  0.78 gives light smoothing
  without adding a large delay.
*/

const HAND_SMOOTHING = 0.78;


/* =========================================================
   DETECTION ZONES
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
   MUSIC
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
   GUITAR INITIALIZATION
========================================================= */

function initInstrument() {
  if (instrumentReady) {
    if (
      audioCtx.state ===
      "suspended"
    ) {
      audioCtx.resume();
    }

    return true;
  }

  if (
    typeof WebAudioFontPlayer !==
      "function" ||

    typeof _tone_0250_LK_AcousticSteel_SF2_file ===
      "undefined"
  ) {
    showError(
      "The acoustic-guitar library did not load. Check the Internet connection."
    );

    return false;
  }

  audioCtx =
    new (
      window.AudioContext ||
      window.webkitAudioContext
    )();

  player =
    new WebAudioFontPlayer();

  output =
    audioCtx.createGain();

  output.gain.value =
    Number(volume.value);

  output.connect(
    audioCtx.destination
  );

  player.loader.decodeAfterLoading(
    audioCtx,

    "_tone_0250_LK_AcousticSteel_SF2_file"
  );

  instrumentReady = true;

  return true;
}


/* =========================================================
   PLAY NOTE
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

    audioCtx.currentTime +
      delay,

    midi,
    duration,

    Math.min(
      0.95,
      velocity
    )
  );
}


/* =========================================================
   PLAY CHORD
========================================================= */

function strum(
  chordIndex = selectedChord,
  velocity = 0.75,
  upward = false
) {
  const chord =
    CHORDS[chordIndex];

  const notes =
    upward
      ? [...chord.m].reverse()
      : chord.m;

  notes.forEach(
    (midi, index) => {
      const delay =
        index *
        (
          0.026 +
          (
            1 -
            velocity
          ) *
          0.018
        );

      note(
        midi,
        velocity,
        delay,
        2
      );
    }
  );

  selectedChord =
    chordIndex;

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


function stopSound() {
  if (player && audioCtx) {
    player.cancelQueue(
      audioCtx
    );
  }
}


/* =========================================================
   CONCERT MODE
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
        (
          concertStep * 2 +
          2
        ) %
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

  manualBtn.classList.remove(
    "active"
  );

  concertBtn.classList.add(
    "active"
  );

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


function setManual() {
  mode = "manual";

  manualBtn.classList.add(
    "active"
  );

  concertBtn.classList.remove(
    "active"
  );

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
========================================================= */

function resize() {
  /*
    1.25 provides better performance
    while remaining sharp on a projector.
  */

  const pixelRatio =
    Math.min(
      window.devicePixelRatio || 1,
      1.25
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

      velocityX:
        (Math.random() - 0.5) *
        4.2,

      velocityY:
        (Math.random() - 0.5) *
        4.2,

      life: 1,

      size:
        Math.random() *
        3.2 + 1,

      color
    });
  }

  /*
    Lower particle limit reduces lag.
  */

  if (particles.length > 200) {
    particles.splice(
      0,
      particles.length - 200
    );
  }
}


function animate() {
  /*
    Clear the canvas fully.

    Do not use a black fill.
    A black fill hides the camera.
  */

  fx.clearRect(
    0,
    0,
    innerWidth,
    innerHeight
  );

  for (const particle of particles) {
    particle.x +=
      particle.velocityX;

    particle.y +=
      particle.velocityY;

    particle.velocityX *=
      0.98;

    particle.velocityY *=
      0.98;

    particle.life -=
      0.026;

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
   COORDINATES

   No mirror conversion is used.

   Real right hand:
   right side of the image.

   Real left hand:
   left side of the image.
========================================================= */

function pointFromLandmark(
  landmark
) {
  return {
    x:
      landmark.x,

    y:
      landmark.y,

    screenX:
      landmark.x *
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
   LIGHTWEIGHT SMOOTHING
========================================================= */

function smoothPoint(
  previousPoint,
  newPoint
) {
  if (!newPoint) {
    return null;
  }

  if (!previousPoint) {
    return {
      ...newPoint
    };
  }

  return {
    x:
      previousPoint.x *
      (
        1 -
        HAND_SMOOTHING
      ) +

      newPoint.x *
      HAND_SMOOTHING,

    y:
      previousPoint.y *
      (
        1 -
        HAND_SMOOTHING
      ) +

      newPoint.y *
      HAND_SMOOTHING,

    screenX:
      previousPoint.screenX *
      (
        1 -
        HAND_SMOOTHING
      ) +

      newPoint.screenX *
      HAND_SMOOTHING,

    screenY:
      previousPoint.screenY *
      (
        1 -
        HAND_SMOOTHING
      ) +

      newPoint.screenY *
      HAND_SMOOTHING
  };
}


/* =========================================================
   DRAW HAND
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

  hc.strokeStyle =
    color;

  hc.fillStyle =
    "#ffffff";

  hc.lineWidth =
    1.8;

  /*
    Keep a small glow.
    Large shadows create GPU lag.
  */

  hc.shadowBlur =
    4;

  hc.shadowColor =
    color;

  for (
    const [
      startIndex,
      endIndex
    ] of connections
  ) {
    const start =
      pointFromLandmark(
        landmarks[startIndex]
      );

    const end =
      pointFromLandmark(
        landmarks[endIndex]
      );

    hc.beginPath();

    hc.moveTo(
      start.screenX,
      start.screenY
    );

    hc.lineTo(
      end.screenX,
      end.screenY
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
      2.8,
      0,
      Math.PI * 2
    );

    hc.fill();
  }

  hc.restore();
}


/* =========================================================
   HAND INTERACTION
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


  /* CHORD HAND */

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
        7
      );
    }

    leftPower =
      Math.min(
        100,
        leftPower + 9
      );

    if (Math.random() < 0.25) {
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


  /* GUITAR HAND */

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
          now -
          lastRightTime
        );

      const speed =
        Math.hypot(
          deltaX,
          deltaY
        ) /
        elapsed *
        1000;


      if (
        speed > 0.31 &&
        now - lastPlay > 135
      ) {
        strum(
          selectedChord,

          Math.min(
            0.92,

            Math.max(
              0.40,
              speed * 0.72
            )
          ),

          deltaY < 0
        );

        playedNote.textContent =
          "STRUM";

        lastPlay =
          now;
      }

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
          MELODY[
            melodyIndex
          ],

          Math.min(
            0.62,

            Math.max(
              0.30,
              speed + 0.25
            )
          ),

          0,
          1.4
        );

        playedNote.textContent =
          "LIVE NOTE";

        lastPlay =
          now;
      }


      rightPower =
        Math.min(
          100,
          speed * 118
        );


      if (Math.random() < 0.30) {
        burst(
          rightPerformancePoint.screenX,
          rightPerformancePoint.screenY,

          "#f15ee8",

          Math.max(
            1,

            Math.floor(
              speed * 4
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
        "Then move your right hand inside the guitar field";
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

  const classifications =
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

      smoothLeftPoint = null;
      smoothRightPoint = null;
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


  let rawLeftPoint = null;
  let rawRightPoint = null;


  detectedHands.forEach(
    (
      landmarks,
      index
    ) => {
      const classification =
        classifications[index];

      /*
        selfieMode is disabled.

        Therefore MediaPipe now reports
        the real physical hand.
      */

      const label =
        classification?.label ||
        (
          index === 0
            ? "Left"
            : "Right"
        );


      const color =
        label === "Left"
          ? "#59ecff"
          : "#f15ee8";


      drawHand(
        landmarks,
        color
      );


      const palmPoint =
        pointFromLandmark(
          landmarks[9]
        );


      if (label === "Left") {
        rawLeftPoint =
          palmPoint;
      } else {
        rawRightPoint =
          palmPoint;
      }
    }
  );


  smoothLeftPoint =
    smoothPoint(
      smoothLeftPoint,
      rawLeftPoint
    );

  smoothRightPoint =
    smoothPoint(
      smoothRightPoint,
      rawRightPoint
    );


  updateInteraction(
    smoothLeftPoint,
    smoothRightPoint
  );
}


/* =========================================================
   MEDIAPIPE INITIALIZATION
========================================================= */

function initHands() {
  hands = new Hands({
    locateFile: (fileName) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${fileName}`
  });

  hands.setOptions({
    maxNumHands: 2,

    /*
      Complexity 0 provides much lower latency.
    */

    modelComplexity: 0,

    minDetectionConfidence:
      0.50,

    minTrackingConfidence:
      0.47,

    /*
      Critical mirror correction.
    */

    selfieMode: false
  });

  hands.onResults(
    onResults
  );
}


/* =========================================================
   FRAME PROCESSING

   One MediaPipe call at a time.
   Approximately 25 analyses per second.
========================================================= */

async function processCameraFrame() {
  const now =
    performance.now();

  if (
    mediaPipeBusy ||
    now - lastMediaPipeFrame < 40 ||
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
   START EXPERIENCE
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

    /*
      640 x 360 significantly reduces latency.
      It remains sufficient for hand detection.
    */

    camera =
      new Camera(video, {
        onFrame:
          processCameraFrame,

        width: 640,
        height: 360
      });

    await camera.start();

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

  mediaPipeBusy = false;
  lastMediaPipeFrame = 0;

  smoothLeftPoint = null;
  smoothRightPoint = null;

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

    camera =
      new Camera(video, {
        onFrame:
          processCameraFrame,

        width: 640,
        height: 360
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
   INITIALIZATION
========================================================= */

resize();
