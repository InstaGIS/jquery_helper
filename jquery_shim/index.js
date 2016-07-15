define([
	'jquery',
	'jquery-ui/ui/widget.js',
	'jquery-ui/ui/widgets/mouse.js',
	'jquery-ui/ui/position.js',
	'jquery-ui/ui/widgets/draggable.js',
	'jquery-ui/ui/widgets/droppable.js',
	'jquery-ui/ui/widgets/resizable.js',
	'jquery-ui/ui/widgets/selectable.js',
	'jquery-ui/ui/widgets/sortable.js',
	'jquery-ui/ui/widgets/progressbar.js',
	'./plugins/jquery.evol.colorpicker.js',
	'./plugins/jquery.ui.rotatable.js',
	'./plugins/jquery.ajax.progress.js',
	'./plugins/jquery.hotkeys.js',
	'jquery.cookie',
	'jquery.waitforChild',
	'jquery-serializejson'
], function (jQ2) {

	var $_GLOBAL = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : Function('return this')();

    $_GLOBAL.jQ2 = jQ2;
    return jQ2;
});