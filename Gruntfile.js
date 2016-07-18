module.exports = function (grunt) {

	var fs = require("fs"),
		// Skip jsdom-related tests in Node.js 0.10 & 0.12
		runJsdomTests = !/^v0/.test(process.version),
		requirejs = require("requirejs"),
		jqFolder = __dirname + "/node_modules/jquery/",
		pkg = require(jqFolder + "package.json"),
		srcFolder = jqFolder + "src/",
		rdefineEnd = /\}\s*?\);[^}\w]*$/,
		read = function (fileName) {
			return grunt.file.read(srcFolder + fileName);
		},
		globals = read("exports/global.js"),
		wrapper = grunt.file.read("src/helpers/wrapper.js").split('@CODE');
	/**
	 * Strip all definitions generated by requirejs
	 * Convert "var" modules to var declarations
	 * "var module" means the module only contains a return
	 * statement that should be converted to a var declaration
	 * This is indicated by including the file in any "var" folder
	 * @param {String} name
	 * @param {String} path
	 * @param {String} contents The contents to be written (including their AMD wrappers)
	 */
	function convert(name, path, contents) {
		var amdName;

		// Convert var modules
		if (/.\/var\//.test(path.replace(process.cwd(), ""))) {
			contents = contents
				.replace(
					/define\([\w\W]*?return/,
					"var " +
					(/var\/([\w-]+)/.exec(name)[1]) +
					" ="
				)
				.replace(rdefineEnd, "");

			// Sizzle treatment
		} else if (/\/sizzle$/.test(name)) {
			contents = "var Sizzle =\n" + contents

			// Remove EXPOSE lines from Sizzle
				.replace(/\/\/\s*EXPOSE[\w\W]*\/\/\s*EXPOSE/, "return Sizzle;");

		} else {

			contents = contents
				.replace(/\s*return\s+[^\}]+(\}\s*?\);[^\w\}]*)$/, "$1")

			// Multiple exports
			.replace(/\s*exports\.\w+\s*=\s*\w+;/g, "");

			// Remove define wrappers, closure ends, and empty declarations
			contents = contents
				.replace(/define\([^{]*?{\s*(?:("|')use strict\1(?:;|))?/, "")
				.replace(rdefineEnd, "");

			// Remove anything wrapped with
			// /* ExcludeStart */ /* ExcludeEnd */
			// or a single line directly after a // BuildExclude comment
			contents = contents
				.replace(/\/\*\s*ExcludeStart\s*\*\/[\w\W]*?\/\*\s*ExcludeEnd\s*\*\//ig, "")
				.replace(/\/\/\s*BuildExclude\n\r?[\w\W]*?\n\r?/ig, "");

			// Remove empty definitions
			contents = contents
				.replace(/define\(\[[^\]]*\]\)[\W\n]+$/, "");
		}


		return contents;
	}

	var config = {
		baseUrl: srcFolder,
		name: "jquery",

		// Allow strict mode
		useStrict: true,

		// We have multiple minify steps
		optimize: "none",

		// Include dependencies loaded with require
		findNestedDependencies: true,

		// Avoid inserting define() placeholder
		skipModuleInsertion: true,

		// Avoid breaking semicolons inserted by r.js
		skipSemiColonInsertion: true,
		wrap: {
			start: wrapper[0].replace(/\/\*eslint .* \*\/\n/, ""),
			end: globals.replace(
				/\/\*\s*ExcludeStart\s*\*\/[\w\W]*?\/\*\s*ExcludeEnd\s*\*\//ig,
				""
			) + wrapper[1]
		},
		rawText: {},
		onBuildWrite: convert
	};


	grunt.registerMultiTask(
		"build",
		"Concatenate source, remove sub AMD definitions, " +
		"(include/exclude modules with +/- flags), embed date/version",
		function () {
			var index,
				done = this.async(),
				flags = this.flags,
				optIn = flags["*"],
				name = grunt.option("filename"),
				minimum = this.data.minimum,
				removeWith = this.data.removeWith,
				excluded = [],
				included = [],
				version = grunt.config("pkg.version"),
				excludeList = function () {},

				/**
				 * Adds the specified module to the excluded or included list, depending on the flag
				 * @param {String} flag A module path relative to
				 *  the src directory starting with + or - to indicate
				 *  whether it should included or excluded
				 */
				excluder = function (flag) {
					var additional,
						m = /^(\+|\-|)([\w\/-]+)$/.exec(flag),
						exclude = m[1] === "-",
						module = m[2];

					if (!exclude) {
						grunt.log.writeln(flag);
						included.push(module);
					} else if (minimum.indexOf(module) === -1) {
						// Can't exclude certain modules

						// Add to excluded
						if (excluded.indexOf(module) === -1) {
							grunt.log.writeln(flag);
							excluded.push(module);

							// Exclude all files in the folder of the same name
							// These are the removable dependencies
							// It's fine if the directory is not there
							try {
								excludeList(fs.readdirSync(srcFolder + module), module);
							} catch (e) {
								grunt.verbose.writeln(e);
							}
						}

						additional = removeWith[module];

						// Check removeWith list
						if (additional) {
							excludeList(additional.remove || additional);
							if (additional.include) {
								included = included.concat(additional.include);
								grunt.log.writeln("+" + additional.include);
							}
						}
					} else {
						grunt.log.error("Module \"" + module + "\" is a minimum requirement.");
						if (module === "selector") {
							grunt.log.error(
								"If you meant to replace Sizzle, use -sizzle instead."
							);
						}
					}

				};

			/**
			 * Recursively calls the excluder to remove on all modules in the list
			 * @param {Array} list
			 * @param {String} [prepend] Prepend this to the module name.
			 *  Indicates we're walking a directory
			 */
			excludeList = function (list, prepend) {
				if (list) {
					prepend = prepend ? prepend + "/" : "";
					list.forEach(function (module) {

						// Exclude var modules as well
						if (module === "var") {
							excludeList(
								fs.readdirSync(srcFolder + prepend + module), prepend + module
							);
							return;
						}
						if (prepend) {

							// Skip if this is not a js file and we're walking files in a dir
							if (!(module = /([\w-\/]+)\.js$/.exec(module))) {
								return;
							}

							// Prepend folder name if passed
							// Remove .js extension
							module = prepend + module[1];
						}

						// Avoid infinite recursion
						if (excluded.indexOf(module) === -1) {
							excluder("-" + module);
						}
					});
				}
			};


			// Filename can be passed to the command line using
			// command line options
			// e.g. grunt build --filename=jquery-custom.js
			name = name ? ("dist/" + name) : this.data.dest;

			// append commit id to version
			if (process.env.COMMIT) {
				version += " " + process.env.COMMIT;
			}

			// figure out which files to exclude based on these rules in this order:
			//  dependency explicit exclude
			//  > explicit exclude
			//  > explicit include
			//  > dependency implicit exclude
			//  > implicit exclude
			// examples:
			//  *                  none (implicit exclude)
			//  *:*                all (implicit include)
			//  *:*:-css           all except css and dependents (explicit > implicit)
			//  *:*:-css:+effects  same (excludes effects because explicit include is
			//                     trumped by explicit exclude of dependency)
			//  *:+effects         none except effects and its dependencies
			//                     (explicit include trumps implicit exclude of dependency)

			Object.keys(flags).forEach(function (flag) {
				if (flag !== '*') {
					excluder(flag);
				}
			});

			// Handle Sizzle exclusion
			// Replace with selector-native
			if ((index = excluded.indexOf("sizzle")) > -1) {
				config.rawText.selector = "define(['./selector-native']);";
				excluded.splice(index, 1);
			}



			grunt.verbose.writeflags(excluded, "Excluded");
			grunt.verbose.writeflags(included, "Included");

			// append excluded modules to version
			if (excluded.length) {
				version += " -" + excluded.join(",-");

				// set pkg.version to version with excludes, so minified file picks it up
				grunt.config.set("pkg.version", version);
				grunt.verbose.writeln("Version changed to " + version);

				// Have to use shallow or core will get excluded since it is a dependency
				config.excludeShallow = excluded;
			}
			config.include = included;

			/**
			 * Handle Final output from the optimizer
			 * @param {String} compiled
			 */
			config.out = function (compiled) {
				compiled = compiled

				// Embed Version
					.replace(/@VERSION/g, version)

				// Embed Date
				// yyyy-mm-ddThh:mmZ
				.replace(/@DATE/g, (new Date()).toISOString().replace(/:\d+\.\d+Z$/, "Z"));

				// Write concatenated source to file
				grunt.file.write(name, compiled);
			};



			// Trace dependencies and concatenate files
			requirejs.optimize(config, function (response) {
				grunt.verbose.writeln(response);
				grunt.log.ok("File '" + name + "' created.");
				done();
			}, function (err) {
				done(err);
			});
		});

	// Special "alias" task to make custom build creation less grawlix-y
	// Translation example
	//
	//   grunt custom:+ajax,-dimensions,-effects,-offset
	//
	// Becomes:
	//
	//   grunt build:*:*:+ajax:-dimensions:-effects:-offset
	grunt.registerTask("custom", function () {
		var args = this.args,
			modules = args.length ? args[0].replace(/,/g, ":") : "",
			done = this.async();

		grunt.log.writeln("Modules are", JSON.stringify(modules));

		function exec() {
			var defaultPath = ["build", "custom"];
			grunt.task.run(["build:*:*" + (modules ? ":" + modules : "")]);
			done();
		}

		grunt.log.writeln("Creating custom build...\n");

		exec();

	});


	grunt.initConfig({
		build: {
			all: {
				dest: "libs/jquery.slim.js",
				minimum: [
					"core",
					"selector"
				],

				// Exclude specified modules if the module matching the key is removed
				removeWith: {
					ajax: ["manipulation/_evalUrl", "event/ajax"],
					callbacks: ["deferred"],
					css: ["effects", "dimensions", "offset"],
					"css/showHide": ["effects"],
					deferred: {
						remove: ["ajax", "effects", "queue", "core/ready"],
						include: ["core/ready-no-deferred"]
					},
					sizzle: ["css/hiddenVisibleSelectors", "effects/animatedSelector"]
				}
			}
		}
	});


	grunt.config('connect', {

		temporary: {
			options: {
				middleware: function (connect, options, middlewares) {

					middlewares.unshift(function (req, res, next) {
						var url = req.url;

						if (url.indexOf('.') === -1) {
							req.url = '/example/index.html';
						}
						return next();
					});
					return middlewares;

				},
				port: 8088,
				base: './'
			}
		},
		local: {
			options: {
				middleware: function (connect, options, middlewares) {

					middlewares.unshift(function (req, res, next) {
						var url = req.url;

						if (url.indexOf('.') === -1) {
							req.url = '/example/index.html';
						}
						return next();
					});
					return middlewares;

				},
				keepalive: true,
				port: 8086,
				base: './'
			}
		}

	});

	grunt.config('concat', {

		hammer: {
			options: {
				stripBanners: {
					block: true
				},
				process: function (src, filepath) {

					// Replaces head with my own code
					if (filepath.indexOf('src/hammer.prefix.js') !== -1) {

						var modified_src = "var $_GLOBAL = typeof window !== 'undefined' ? window :    typeof global !== 'undefined' ? global :    Function('return this')();";

						modified_src = modified_src + '\n' + "'use strict';";
						modified_src = modified_src + '\n' + "var document = $_GLOBAL.document;";
						return modified_src;
					} else if (filepath.indexOf('src/expose.js') !== -1) {

						return src.split('var freeGlobal')[0].replace('window', '$_GLOBAL');

					} else if (filepath.indexOf('src/hammer.suffix.js') !== -1) {
						return "export {Hammer};" + '\n' + "export default Hammer;";
					} else {
						return src.replace('window', '$_GLOBAL');
					}

				}

			},
			src: [
				'node_modules/hammerjs/src/hammer.prefix.js',
				'node_modules/hammerjs/src/utils.js',
				'node_modules/hammerjs/src/input.js',
				'node_modules/hammerjs/src/input/*.js',
				'node_modules/hammerjs/src/touchaction.js',
				'node_modules/hammerjs/src/recognizer.js',
				'node_modules/hammerjs/src/recognizers/*.js',
				'node_modules/hammerjs/src/hammer.js',
				'node_modules/hammerjs/src/manager.js',
				'node_modules/hammerjs/src/expose.js',
				'node_modules/hammerjs/src/hammer.suffix.js'
			],
			dest: 'libs/hammer.es6.js'

		},

		velocityes6: {
			options: {

				stripBanners: {
					block: true
				},
				process: function (src, filepath) {

					var modified_src = (src.split('return function (global, window, document, undefined) {')[1])
						.replace(/global/g, 'jQuery')
						.replace(/window/g, '$_GLOBAL')
						.split('}(($_GLOBAL.jQuery || $_GLOBAL.Zepto || $_GLOBAL), $_GLOBAL, document);');

					if (filepath.indexOf('velocity.js') !== -1) {

						var modified_head = "import jQuery from 'jquery';";
						modified_head = modified_head + '\n' + "'use strict';";
						modified_head = modified_head + '\n' +
							"var $_GLOBAL = typeof window !== 'undefined' ? window :    typeof global !== 'undefined' ? global :    Function('return this')();";
						modified_head = modified_head + '\n' + "var document = $_GLOBAL.document;";

						var intercept_return_final = modified_src[0].replace('return Velocity;', '').split('var DURATION_DEFAULT'),
							intercept_return_begin = intercept_return_final[0].split('if (IE <= 8 && !isJQuery) {');

						modified_head = modified_head + '\n' + intercept_return_begin[0] + '\n' + "var DURATION_DEFAULT" + intercept_return_final[1];


						return modified_head;

					} else if (filepath.indexOf('velocity.ui.js') !== -1) {
						var modified_footer = modified_src[0].split('var velocityVersion');
						return 'var velocityVersion' + modified_footer[1] + '\n' + "export {Velocity};" + '\n' + "export default Velocity;"
					}
				}
			},
			src: [
				'node_modules/velocity-animate/velocity.js',
				'node_modules/velocity-animate/velocity.ui.js'
			],
			dest: 'libs/velocity.es6.js'
		},
		jquery: {

			options: {
				process: function (src, filepath) {


					if (filepath.indexOf('velocity.js') !== -1) {

						var modified_src = (src.split('return function (global, window, document, undefined) {')[1])
							.split('}((window.jQuery || window.Zepto || window), window, document);');


						var intercept_return_final = modified_src[0].replace('return Velocity;', '').split('var DURATION_DEFAULT'),
							intercept_return_begin = intercept_return_final[0].split('if (IE <= 8 && !isJQuery) {');

						var src_con_comentarios = "define(['./jquery.slim.js'],function(global) {" + '\n' + intercept_return_begin[0] + '\n' + '\n' + " var DURATION_DEFAULT" +
							intercept_return_final[1];

						return src_con_comentarios;




					} else {
						return src;
					}
				}
			},
			src: [
				'node_modules/velocity-animate/velocity.js',
				'src/helpers/animation_shim.js'
			],
			dest: 'libs/jquery.js'
		},
		hammer_effects: {
			options: {
				stripBanners: {
					block: true
				},
				process: function (src, filepath) {
					var explodedpath = filepath.split('/'),
						filename = explodedpath.pop().replace('.js', ''),
						modified_src = '',
						common_replaces = function (content) {
							content = content.replace('(function($) {', '').replace('(function ($) {', '');
							content = content.replace('}( jQuery ));', '').replace('})(jQuery);', '');
							content = content.replace('}(jQuery));', '').replace(/methods/g, filename + 'methods');
							content = content.replace(/window/g, '$_GLOBAL').replace(/wodniw/g, 'window');

							return content;
						};


					modified_src = '// Source: ' + filepath + '\n' + common_replaces(src);
					return modified_src;

				}

			},
			// the files to concatenate
			src: [
				"src/helpers/hammer_initial.js",
				"node_modules/materialize-css/js/sideNav.js",
				"node_modules/materialize-css/js/scrollspy.js",
				"node_modules/materialize-css/js/slider.js",
				"node_modules/materialize-css/js/pushpin.js",
				"node_modules/materialize-css/js/transitions.js"

			],
			// the location of the resulting JS file
			dest: 'src/hammer_helper.js'
		},
		material: {
			options: {
				stripBanners: {
					block: true
				},
				process: function (src, filepath) {
					var explodedpath = filepath.split('/'),
						filename = explodedpath.pop().replace('.js', ''),
						modified_src = '',
						common_replaces = function (content) {
							content = content.replace('(function($) {', '').replace('(function ($) {', '');
							content = content.replace('}( jQuery ));', '').replace('})(jQuery);', '');
							content = content.replace('}(jQuery));', '').replace(/methods/g, filename + 'methods');
							content = content.replace(/window/g, '$_GLOBAL').replace(/wodniw/g, 'window');

							return content;
						};


					modified_src = '// Source: ' + filepath + '\n' + common_replaces(src);
					return modified_src;

				}

			},
			// the files to concatenate
			src: [
				"src/helpers/initial.js",
				"src/helpers/collapsible.js",
				"src/helpers/dropdown.js",
				"src/helpers/leanModal.js",
				"node_modules/materialize-css/js/materialbox.js",
				"node_modules/materialize-css/js/tooltip.js",
				"node_modules/materialize-css/js/cards.js",
				"node_modules/materialize-css/js/chips.js",
				"node_modules/materialize-css/js/buttons.js",
				"src/helpers/waves.js"
			],
			// the location of the resulting JS file
			dest: 'src/material_helper.js'

		}


	});

	grunt.registerTask('jspmbuild', function () {
		var done = this.async(),
			Builder = require('jspm').Builder,
			builder = new Builder();

		builder.loadConfig('./jspm.config.js');

		grunt.log.writeln('Processing task jspm build');


		var builderOpts = {
			minify: true,
			sourceMaps: true,
			externals: ['jquery'],
			globalName: 'Materialize',
			globalDeps: {
				'jquery': 'jQuery'
			}

		};


		return builder.buildStatic(
				'src/material_helper.js',
				'dist/jquery_helper.min.js',
				builderOpts)
			.then(function (output) {

				if (output && output.modules) {
					console.dir(output.modules);
				}
				var builderOptsAMD = {
					minify: false,
					sourceMaps: false,
					externals: ['jquery'],
					format: 'umd',
					globalName: 'Materialize',
					globalDeps: {
						'jquery': 'jQuery'
					}

				};


				return builder.buildStatic(
					'src/material_helper.js',
					'dist/jquery_helper.js',
					builderOptsAMD);

			}).then(function (output) {
				if (output && output.modules) {
					console.dir(output.modules);
				}
				var builderOptsESM = {
					minify: false,
					sourceMaps: false,
					format: 'esm',
					globalName: 'Materialize',
					externals: ['jquery'],
					globalDeps: {
						'jquery': 'jQuery'
					}

				};


				return builder.buildStatic(
					'src/material_helper.js',
					'dist/jquery_helper.esm.js',
					builderOptsESM);


			}).then(function (output) {
				if (output && output.modules) {
					console.dir(output.modules);
				}
				done();
			}).catch(function (err) {
				console.trace(err);
				done();
			});

	});
	grunt.registerTask('concates6', ['concat:hammer', 'concat:material']);

	grunt.registerTask('publish', ['concates6', 'jspmbuild']);

	grunt.loadNpmTasks('grunt-contrib-connect');
	grunt.loadNpmTasks('grunt-contrib-concat');
};
