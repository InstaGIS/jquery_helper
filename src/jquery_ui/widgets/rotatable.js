/*!
 * jQuery UI Rotatable
 */
import $ from 'jquery';
import {
	ui
} from '../position.js';
import {
	widget
} from '../widget.js';

import {
	mouse
} from './mouse.js';

import {
	plugin
} from '../plugin.js';


widget("ui.rotatable", mouse, {

	options: {
		handle: false,
		angle: false,

		// callbacks
		start: null,
		rotate: null,
		stop: null
	},

	handle: function (handle) {
		if (handle === undefined) {
			return this.options.handle;
		}
		this.options.handle = handle;
	},

	angle: function (angle) {
		if (angle === undefined) {
			return this.options.angle;
		}
		this.options.angle = angle;
		this.performRotation(this.options.angle);
	},

	_create: function () {
		var handle;
		if (!this.options.handle) {
			handle = $(document.createElement('div'));
			handle.addClass('ui-rotatable-handle');
		} else {
			handle = this.options.handle;
		}

		this.listeners = {
			rotateElement: $.proxy(this.rotateElement, this),
			startRotate: $.proxy(this.startRotate, this),
			stopRotate: $.proxy(this.stopRotate, this)
		};

		handle.draggable({
			helper: 'clone',
			start: this.dragStart,
			handle: handle
		});

		handle.appendTo(this.element);
		handle.on('mousedown', this.listeners.startRotate);

		if (this.options.angle !== false) {
			this.elementCurrentAngle = this.options.angle;
			this.performRotation(this.elementCurrentAngle);
		} else {
			this.elementCurrentAngle = 0;
		}
	},

	_destroy: function () {
		this.element.removeClass('ui-rotatable');
		this.element.find('.ui-rotatable-handle').remove();
	},

	performRotation: function (angle) {
		this.element.css('transform', 'rotate(' + angle + 'rad)');
		this.element.css('-moz-transform', 'rotate(' + angle + 'rad)');
		this.element.css('-webkit-transform', 'rotate(' + angle + 'rad)');
		this.element.css('-o-transform', 'rotate(' + angle + 'rad)');
	},

	getElementOffset: function () {
		this.performRotation(0);
		var offset = this.element.offset();
		this.performRotation(this.elementCurrentAngle);
		return offset;
	},

	getElementCenter: function () {
		var elementOffset = this.getElementOffset();
		var elementCentreX = elementOffset.left + this.element.width() / 2;
		var elementCentreY = elementOffset.top + this.element.height() / 2;
		return [elementCentreX, elementCentreY];
	},

	dragStart: function (event) {
		if (this.element) {
			return false;
		}
	},

	startRotate: function (event) {
		var center = this.getElementCenter();
		var startXFromCenter = event.pageX - center[0];
		var startYFromCenter = event.pageY - center[1];
		this.mouseStartAngle = Math.atan2(startYFromCenter, startXFromCenter);
		this.elementStartAngle = this.elementCurrentAngle;
		this.hasRotated = false;

		this._propagate("start", event);

		$(document).on('mousemove', this.listeners.rotateElement);
		$(document).on('mouseup', this.listeners.stopRotate);

		return false;
	},

	rotateElement: function (event) {
		if (!this.element) {
			return false;
		}

		var center = this.getElementCenter();

		var xFromCenter = event.pageX - center[0];
		var yFromCenter = event.pageY - center[1];
		var mouseAngle = Math.atan2(yFromCenter, xFromCenter);
		var rotateAngle = mouseAngle - this.mouseStartAngle + this.elementStartAngle;

		this.performRotation(rotateAngle);
		this.element.data('angle', rotateAngle);

		var previousRotateAngle = this.elementCurrentAngle;
		this.elementCurrentAngle = rotateAngle;


		// Plugins callbacks need to be called first.
		this._propagate("rotate", event);

		if (previousRotateAngle !== rotateAngle) {
			this._trigger("rotate", event, this.ui());
			this.hasRotated = true;
		}

		return false;
	},

	stopRotate: function (event) {
		if (!this.element) {
			return;
		}

		$(document).off('mousemove', this.listeners.rotateElement);
		$(document).off('mouseup', this.listeners.stopRotate);

		this.elementStopAngle = this.elementCurrentAngle;
		if (this.hasRotated) {
			this._propagate("stop", event);
		}

		setTimeout(function () {
			this.element = false;
		}, 10);
		return false;
	},

	_propagate: function (n, event) {
		plugin.call(this, n, [event, this.ui()]);
		if (n !== "rotate") {
			this._trigger(n, event, this.ui());
		}
	},

	plugins: {},

	ui: function () {
		return {
			element: this.element,
			angle: {
				start: this.elementStartAngle,
				current: this.elementCurrentAngle,
				stop: this.elementStopAngle
			}
		};
	}

});

var rotatable = $.ui.rotatable;
export {
	rotatable
};
