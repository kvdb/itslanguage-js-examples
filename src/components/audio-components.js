/* eslint-disable
 max-len,
 no-unused-vars
 */

require('./audio-components.css');
const guid = require('guid');
const Tools = require('itslanguage').Tools;

/**
 * @title ITSLanguage Javascript Audio
 * @overview This is part of the ITSLanguage Javascript SDK to perform audio related functions.
 * @copyright (c) 2014 ITSLanguage
 * @license MIT
 * @author d-centralize
 */

/**
 @module its
 ITSLanguage Audio module.
 */

class Player {
  /**
   * ITSLanguage Audio module.
   *
   * @constructor
   * @param {object} [options] Override any of the default settings.
   *
   */
  constructor(options) {
    this.settings = Object.assign({
      // For smoother playback position indication, poll for position updates
      // faster than the browser default (which is often ~250ms).
      pollFreq: 75
    }, options);

    this._writeUI(this.settings.element);

    this.player = this.settings.player;
    const self = this;

    this.player.addEventListener('playing', () => {
      self._setPlaying();
      self._startPollingForPosition(self.settings.pollFreq);
    });
    this.player.addEventListener('timeupdate', () => {
      self._getTimeUpdate();
    });
    // In case the event was already fired, try to update audio stats.
    this._timeUpdate();
    this.player.addEventListener('durationchange', () => {
      self._timeUpdate();
    });
    this.player.addEventListener('canplay', () => {
      self._setPlayable();
    });
    // The `canplay` event may have been fired already when the audio
    // player was already initialised. Call _setPlayable() in that case.
    if (this.player.canPlay()) {
      self._setPlayable();
    }
    this.player.addEventListener('ended', () => {
      self._setNotPlaying();
      self._stopPollingForPosition();
    });
    this.player.addEventListener('pause', () => {
      self._setNotPlaying();
      self._stopPollingForPosition();
    });
    this.player.addEventListener('progress', () => {
      self._loadingUpdate();
    });
    this.player.addEventListener('error', () => {
      self._stopPollingForPosition();
      self._setError();
    });
    this.player.addEventListener('unloaded', () => {
      self._stopPollingForPosition();
      self._setNotPlayable();
      // Sets the time to 0:00.0 / 0:00.0 when no audio is loaded.
      self._getTimeUpdate();
    });
    // In case the event was already fired, try to update audio stats.
    self._loadingUpdate();
  }

  /**
   * Handle user interaction with dragger element.
   *
   * @param {object} range The range element over which the dragger is dragged.
   * @param {object} dragger The dragger element which the user can grab.
   * @param {callback} onDrag Called while dragging.
   * @param {callback} onDragEnd Called when dragging action completed.
   */
  _applyRangeSlider(range, dragger, onDrag, onDragEnd) {
    const draggerWidth = parseInt(getComputedStyle(dragger).width);
    this.draggerDown = false;

    dragger.style.width = draggerWidth + 'px';
    dragger.style.left = -draggerWidth + 'px';
    dragger.style.marginLeft = draggerWidth / 2 + 'px';
    const rangeWidth = parseInt(getComputedStyle(range).width);
    const rangeLeft = _getPosition(range).x;

    /* The mousedown event is bound to the range slider to pick up the user
     intent for dragging this slider. Then, mousemove and mouseup are bound
     to the document to follow the mouse outside the slider area.
     */

    const self = this;
    range.addEventListener('mousedown', e => {
      self.draggerDown = true;
      updateDragger(e);
      return false;
    });

    document.addEventListener('mousemove', e => {
      updateDragger(e);
    });

    document.addEventListener('mouseup', e => {
      // This event fires on all slider instances listening on document
      // mousup, therefore stop executing if this slider was not the
      // one starting the drag.
      if (self.draggerDown === false) {
        return false;
      }

      self.draggerDown = false;

      // Seek audio when done scrubbing
      if (onDragEnd instanceof Function) {
        onDragEnd(getPostionAsPercentage(e));
      }
    });

    /*
     * The absolute position of an element on a page can be retrieved by traversing
     * the parents and adding the offsets.
     */
    function _getPosition(element) {
      let xPosition = 0;
      let yPosition = 0;

      while (element) {
        xPosition += element.offsetLeft - element.scrollLeft + element.clientLeft;
        yPosition += element.offsetTop - element.scrollTop + element.clientTop;
        element = element.offsetParent;
      }
      return {
        x: xPosition,
        y: yPosition
      };
    }

    function getPostionAsPercentage(e) {
      return Math.round((e.pageX - rangeLeft) / rangeWidth * 100);
    }

    function updateDragger(e) {
      // Check if mouse is within acceptable range to react to
      if (self.draggerDown && e.pageX >= rangeLeft &&
        e.pageX <= rangeLeft + rangeWidth) {
        const pct = getPostionAsPercentage(e);
        if (onDrag instanceof Function) {
          onDrag(pct);
        }
      }
    }
  }

  /**
   * Appends the player GUI to the DOM.
   *
   * @param {element} ui The DOM element to append GUI to.
   */
  _writeUI(ui) {
    const playerContent = this._getUI();
    ui.innerHTML = playerContent;

    const id = this.playerId;
    this.playtoggle = document.getElementById(id + 'playtoggle');
    this.range = document.getElementById(id + 'range');
    this.loading = document.getElementById(id + 'loading');
    this.dragger = document.getElementById(id + 'dragger');
    this.timeindication = document.getElementById(id + 'timeindication');

    const self = this;
    this.playtoggle.onclick = function() {
      self.player.togglePlayback();
    };

    function onDrag(pct) {
      // Update the playing time as it would be playing once the user
      // would release the dragger.
      self._timeUpdate(pct);
      self._updatePositionIndication(pct);
    }

    function onDragEnd(pct) {
      // Start playing audio at the new position now the dragger has
      // been released.
      self.player.scrub(pct);
    }

    this._applyRangeSlider(this.range, this.dragger, onDrag, onDragEnd);
  }

  /**
   * Update the loading bar to reflect the actual buffer fill.
   */
  _loadingUpdate() {
    const loaded = this.player.getBufferFill();
    this.loading.style.width = loaded + '%';
  }

  /**
   * Defines the player GUI.
   * Hint: ideal for overriding in a subclass.
   *
   */
  _getUI() {
    const id = this.playerId = guid.create();
    const player = `
      <!-- Container as play area. -->
      <p class="player">
        <!-- Play button container class -->
        <button id="${id}playtoggle" class="playToggle" disabled>
          <!-- Play icon -->
          <div class="icon"></div>
        </button>
        <span id="${id}range" class="gutter">
        <span id="${id}loading" class="loading"></span>
          <button id="${id}dragger" class="handle" disabled></button>
        </span>
        <span id="${id}timeindication" class="timeindication"></span>
      </p>`;
    return player;
  }

  /**
   * Return a formatted time given a high precision second count.
   *
   * @param {number} [seconds] Any number of seconds. Use float for high accuracy output.
   * @returns A duration in the form of mm:ss.nn (minutes, seconds, partial seconds).
   */
  _timerText(seconds) {
    const mins = Math.floor(seconds / 60, 10);
    const secs = parseInt(seconds - mins * 60, 10);
    const decimal = parseInt((seconds - mins * 60 - secs) * 10, 10);
    return mins + ':' + (secs < 10 ? '0' + secs : secs) + '.' + decimal;
  }

  /**
   * Calculates the new time indication based on the current audio position.
   * Also update the GUI with this new time indication.
   *
   * @param {number} [pct] Audio completion percentage to use for time indication, overriding the actual audio playing
   *   time.
   */
  _timeUpdate(pct) {
    const duration = this.player.getDuration();
    let offset = null;
    if (pct !== undefined) {
      // Display time while seeking, not currentTime in audio.
      offset = duration * pct / 100;
    } else {
      offset = this.player.getCurrentTime();
    }

    const text = this._timerText(offset) + ' / ' + this._timerText(duration);
    this._updateTimeIndication(text);
  }

  /**
   * Calculates the new position indication based on the current audio
   * position.
   * Also update the GUI with this new position indication.
   */
  _positionUpdate() {
    const duration = this.player.getDuration();
    let pos = 0;
    // Prevent division by zero errors when no audio is loaded
    // and duration is 0.
    if (duration > 0) {
      pos = this.player.getCurrentTime() * 100 / this.player.getDuration();
    }
    this._updatePositionIndication(pos);
  }

  /**
   * Update the time indication
   *
   * @param {string} text The time to show.
   */
  _updateTimeIndication(text) {
    this.timeindication.innerHTML = text;
  }

  /**
   * Update the dragger position.
   *
   * @param {number} pct The percentage (1..100) of audio stream completion.
   */
  _updatePositionIndication(pct) {
    // Due to the dragger having an offset to the range, compute px from %.
    const rangeWidth = this.range.offsetWidth;
    const draggerWidth = parseInt(getComputedStyle(this.dragger).width);
    const left = rangeWidth * pct / 100 - draggerWidth;
    this.dragger.style.left = left + 'px';
  }

  /**
   * Get the current playing time for the audio.
   */
  _getTimeUpdate() {
    // Don't update time and position from audio when position
    // dragger is being used.
    if (!this.draggerDown) {
      this._timeUpdate();
      this._positionUpdate();
    }
  }

  /**
   * Start polling frequently for the current playing time of the audio.
   * By default, browsers use resources very conservative and don't provide
   * time updates frequently enough for the GUI to have a smooth slider.
   *
   * @param {number} pollFreq The polling frequency in milliseconds.
   */
  _startPollingForPosition(pollFreq) {
    const self = this;
    if (this.pollInterval || !pollFreq) {
      return;
    }

    console.log('Start polling for audio position.');
    this.pollInterval = setInterval(() => {
      self._getTimeUpdate();
    }, pollFreq);
  }

  /**
   * Stop polling for the current playing time of the audio.
   */
  _stopPollingForPosition() {
    if (this.pollInterval) {
      console.log('Stopped polling for audio position.');
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  _setPlaying() {
    console.log('Playbutton set to playing state');
    this.playtoggle.classList.add('playing');
  }

  _setNotPlaying() {
    console.log('Playbutton set to non-playing state');
    this.playtoggle.classList.remove('playing');
  }

  _setPlayable() {
    console.log('Playbutton set to a playable state');
    this.playtoggle.removeAttribute('disabled');
    if (this.dragger) {
      this.dragger.removeAttribute('disabled');
    }
  }

  _setNotPlayable() {
    console.log('Playbutton set to a non-playable state');
    this.playtoggle.setAttribute('disabled', 'disabled');
    if (this.dragger) {
      this.dragger.setAttribute('disabled', 'disabled');
    }
  }

  _setError() {
    this._setNotPlaying();
    this.playtoggle.classList.add('error');
  }
}

class MiniPlayer {
  /**
   * Defines the miniplayer GUI.
   *
   */
  _getUI() {
    const id = this.playerId = guid.create();
    const player = `
      <!-- Container as play area. -->
      <p class="player">
        <!-- Play button container class -->
        <button id="${id}playtoggle" class="playToggle" disabled>
          <!-- Play icon -->
          <div class="icon"></div>
        </button>
      </p>`;
    return player;
  }

  /* These GUI related callbacks should be ignored in this subclass */

  _applyRangeSlider(range, dragger, onDrag, onDragEnd) {
  }

  _updateTimeIndication(text) {
  }

  _loadingUpdate() {
  }

  _updatePositionIndication(pct) {
  }
}

class VolumeCanvas {
  /**
   * ITSLanguage Canvas VU meter component.
   *
   * @constructor
   * @param {object} [options] Override any of the default settings.
   */
  constructor(options) {
    this.settings = Object.assign({
      bgColour: '#555',
      startAngle: 0.7 * Math.PI,
      // endAngle is 0.3 * Math.PI, but easier to work with when going
      // through 0 and keep counting from 2 PI.
      endAngle: 2.3 * Math.PI,
      lineWidth: 5
    }, options);

    const canvas = this.settings.canvas;
    // Canvas sizes through width and height properties (non-CSS).
    // Grab the CSS values and apply them so we're able to determine size
    // through CSS.
    this.W = parseInt(getComputedStyle(canvas).width);
    this.H = parseInt(getComputedStyle(canvas).height);
    canvas.width = this.W;
    canvas.height = this.H;

    this.ctx = canvas.getContext('2d');
  }

  /**
   * Draw a new volume indication the canvas.
   *
   * @param {number} volume Volume level between 0 (min) and 1 (max).
   */
  draw(volume) {
    this._initCanvas();

    // Scale degrees: 0 to 288.
    const degrees = 288 * volume;
    const radians = degrees * Math.PI / 180;
    const maxAngle = this.settings.startAngle + radians;
    // Draw background arc
    this._drawArc(1.0, this.settings.bgColour, this.settings.startAngle, this.settings.endAngle);

    const orangeStart = 1.5 * Math.PI;
    const redStart = 1.9 * Math.PI;
    // Draw green part
    this._drawArc(1.0, 'rgb(82, 240, 55)', this.settings.startAngle, orangeStart, maxAngle);
    // Draw orange part
    this._drawArc(1.0, 'rgb(198, 111, 0)', orangeStart, redStart, maxAngle);
    // Draw red part
    this._drawArc(1.0, 'rgb(255, 0, 0)', redStart, this.settings.endAngle, maxAngle);
  }

  _initCanvas() {
    const ctx = this.ctx;
    // Clear the canvas everytime a chart is drawn
    ctx.clearRect(0, 0, this.W, this.H);
  }

  _drawArc(alphaValue, colour, startAngle, endAngle, maxAngle) {
    // http://www.html5canvastutorials.com/tutorials/html5-canvas-arcs/
    //
    //      1.5 PI
    //    _--->>---_
    //   /          \
    // 1 PI    x    0 PI   Start angle  Ending angle
    //   \          /
    //    ^---<<----
    //     .5 PI
    //    2.5 PI (when easier to calculate)

    // Check if it makes sense to draw this arc at all (red arc is not
    // needed at all when all when we only draw half the green arc)
    if (maxAngle && maxAngle <= startAngle) {
      return;
    }
    // If we only need to draw a part of this arc, make sure to end early.
    if (maxAngle && maxAngle < endAngle) {
      endAngle = maxAngle;
    }

    const ctx = this.ctx;
    ctx.beginPath();
    ctx.globalAlpha = alphaValue;
    ctx.strokeStyle = colour;
    ctx.lineWidth = this.settings.lineWidth;
    const x = this.W / 2;
    const y = this.H / 2;
    const radius = this.W / 2 - this.settings.lineWidth / 2;
    const counterClockwise = false;
    ctx.arc(x, y, radius, startAngle, endAngle, counterClockwise);
    ctx.stroke();
  }
}

class Recorder extends Player {
  /**
   * ITSLanguage Record component.
   *
   * @constructor
   * @param {object} [options] Override any of the default settings.
   */
  constructor(options) {
    super(Object.assign({
      // In seconds
      maxRecordingDuration: 10
    }, options));

    this._drawingCompatibility();

    this.recorder = this.settings.recorder;

    // Either the recorder already has recording approval, ..
    if (this.recorder.hasUserMediaApproval()) {
      this._permitRecorder();
    }
    // .. or an event will trigger soon.
    this.recorder.addEventListener('ready', () => {
      this._permitRecorder();
    });

    this.stopwatch = new Tools.Stopwatch(elapsed => {
      const seconds = elapsed / 10;
      this._updateTimer(seconds);
      if (this.settings.maxRecordingDuration &&
        this.settings.maxRecordingDuration <= seconds) {
        this.recorder.stop(true);
      }
    });
    this.recorder.addEventListener('recording', id => {
      this.dot.classList.remove('off');
      this.stopwatch.reset();
      this.stopwatch.start();
    });

    this.recorder.addEventListener('recorded', (id, blob, forced) => {
      this.stopwatch.stop();
      this.dot.classList.add('off');

      const blobUrl = window.URL.createObjectURL(blob);
      this.player.load(blobUrl);
    });

    // The addEventListener interface exists on object.Element DOM elements.
    // However, this is just a simple class without any relation to the DOM.
    // Therefore we have to implement a pub/sub mechanism ourselves.
    // See:
    // https://developer.mozilla.org/en-US/docs/Web/API/EventTarget.addEventListener
    // http://stackoverflow.com/questions/10978311/implementing-events-in-my-own-object
    this.events = {};

    this.addEventListener = (name, handler) => {
      if (this.events.hasOwnProperty(name)) {
        this.events[name].push(handler);
      } else {
        this.events[name] = [handler];
      }
    };

    this.removeEventListener = (name, handler) => {
      if (!this.events.hasOwnProperty(name)) {
        return;
      }

      const index = this.events[name].indexOf(handler);
      if (index !== -1) {
        this.events[name].splice(index, 1);
      }
    };

    this.fireEvent = (name, args) => {
      if (!this.events.hasOwnProperty(name)) {
        return;
      }
      if (!args) {
        args = [];
      }

      for (const ev of this.events[name]) {
        ev(...args);
      }
    };
  }

  /**
   * Logs browser compatibility for canvas drawing.
   * In case of compatibility issues, an error is thrown.
   */
  _drawingCompatibility() {
    // Canvas (basic support)
    // Method of generating fast, dynamic graphics using JavaScript.
    // http://caniuse.com/#feat=canvas
    const canCreateCanvas = Boolean(window.HTMLCanvasElement);
    console.log('Native Canvas capability: ', canCreateCanvas);

    if (!canCreateCanvas) {
      throw new Error('No Canvas element capabilities');
    }
  }

  /**
   * Appends the player GUI to the DOM.
   *
   * @param {element} ui The DOM element to append GUI to.
   */
  _writeUI(ui) {
    // Call super
    super._writeUI(ui);

    const id = this.playerId;
    this.recordtoggle = document.getElementById(id + 'recordtoggle');
    this.dot = document.getElementById(id + 'dot');
    this.timeindication = document.getElementById(id + 'timeindication');

    this.recordtoggle.onclick = () => {
      if (this.recorder.hasUserMediaApproval()) {
        this.recorder.toggleRecording();
        if (this.recorder.isRecording()) {
          this.fireEvent('recording');
        } else {
          this.fireEvent('recorded');
        }
      } else {
        this.recorder.requestUserMedia();
      }
    };

    // Draw a Volume Canvas
    const canvas = document.getElementById(id + 'canvas');
    this.canvas = new VolumeCanvas({
      canvas
    });
    this.canvas.draw(0);
  }

  /**
   * Defines the recorder GUI.
   *
   */
  _getUI() {
    // Call super
    const player = super._getUI();
    const id = this.playerId;
    const recorder = `
      <!-- Container to place recording area to the left of the play area. -->
      <div class="recorder">
        <!-- VU meter ring -->
        <canvas id="${id}canvas" class="canvas"></canvas>
        <!-- Record button container class -->
        <button id="${id}recordtoggle" class="recordToggle noPermission">
          <!-- Microphone icon -->
          <div class="icon"></div>
          <!-- Red pulsating dot -->
          <div id="${id}dot" class="pulse off"></div>
        </button>
      </div>`;
    const wrapper = '<div class="combinator">' + recorder + player + '</div>';
    return wrapper;
  }

  _permitRecorder() {
    this.recordtoggle.classList.remove('noPermission');
  }

  enableRecorder() {
    this.recordtoggle.removeAttribute('disabled');
  }

  disableRecorder() {
    this.recordtoggle.setAttribute('disabled', 'disabled');
  }

  /**
   * Subscribe to numeric volume updates and update the visual volume indication.
   *
   * @param {its.Audio.Tools.VolumeMeter} [vu] The VolumeMeter that provides volume information from a stream.
   *
   */
  attachVolumeMeter(vu) {
    vu.getVolumeIndication(volume => {
      // Convert 1..100 scale to 0..1
      this.canvas.draw(volume / 100);
    });
  }

  /**
   * Set the maximum recording duration.
   *
   * @param {number} duration Set the number of seconds a recording is allowed to last (10s is the default. Set null
   *   for no limit).
   *
   */
  setMaxRecordingDuration(duration) {
    this.settings.maxRecordingDuration = duration;
  }

  /**
   * Updates the timer of the player to reflace recorded time and maximum recording time.
   *
   * @param {number} elapsed Amount of time passed (in seconds) since recording started.
   */
  _updateTimer(elapsed) {
    const text = this._timerText(elapsed) + ' / ' + this._timerText(this.settings.maxRecordingDuration);
    this._updateTimeIndication(text);
  }
}

module.exports = {
  MiniPlayer,
  Player,
  Recorder,
  VolumeCanvas
};