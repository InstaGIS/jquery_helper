VERSION = $(shell cat package.json | sed -n 's/.*"version": "\([^"]*\)",/\1/p')

SHELL = /usr/bin/env bash

default: build
.PHONY: default build install tag jquery material test release

version:
	@echo $(VERSION)
	
jquery:
	grunt build:full:*:-deprecated:-manipulation/_evalUrl:-exports/amd:-ajax/jsonp:-ajax/load:-ajax/parseXML:-ajax/script:-ajax/var/location:-ajax/var/nonce:-ajax/var/rquery:-ajax/xhr:-manipulation/_evalUrl
	grunt build:min:*:-deprecated:-manipulation/_evalUrl:-exports/amd:-ajax/jsonp:-ajax/load:-ajax/parseXML:-ajax/script:-ajax/var/location:-ajax/var/nonce:-ajax/var/rquery:-ajax/xhr:-manipulation/_evalUrl
	

build: jquery helpers

material:	
	grunt concat

test:
	grunt test:fast
	grunt test:bootstrap
	grunt test:material

helpers: material build_helpers helper_replacement bundled_helpers

bundled_helpers:
	grunt build:material:*:-deprecated:-manipulation/_evalUrl:-exports/amd:-ajax/jsonp:-ajax/load:-ajax/parseXML:-ajax/script:-ajax/var/location:-ajax/var/nonce:-ajax/var/rquery:-ajax/xhr:-manipulation/_evalUrl
	grunt build:bootstrap:*:-deprecated:-manipulation/_evalUrl:-exports/amd:-ajax/jsonp:-ajax/load:-ajax/parseXML:-ajax/script:-ajax/var/location:-ajax/var/nonce:-ajax/var/rquery:-ajax/xhr:-manipulation/_evalUrl

build_helpers:	
	jspm build jquery_ui/material_helper.js dist/material_helper.js --skip-source-maps --skip-encode-names --global-name material_helper
	jspm build jquery_ui/bootstrap_helper.js dist/bootstrap_helper.js --skip-source-maps --skip-encode-names --global-name bootstrap_helper

helper_replacement:
	csplit -n2 -s -b bootstrap%d\.js dist/bootstrap_helper.js "/var widgetUuid/"
	csplit -n2 -s -b material%d\.js dist/material_helper.js "/var requestAnimationFrame/"

	csplit -n2 -s -b bootstrap0%d\.js xxbootstrap1.js "/Object.defineProperty/"
	csplit -n2 -s -b material0%d\.js xxmaterial1.js "/Object.defineProperty/"
	cat src/helpers/prefix.js xxmaterial00.js src/helpers/suffix.js > src/jquery_shim/material_helper.js
	cat src/helpers/prefix.js xxbootstrap00.js src/helpers/suffix.js > src/jquery_shim/bootstrap_helper.js
	rm xx*




install:
	npm install
	jspm install

update_version:
	@echo "Current version is " ${VERSION}
	@echo "Next version is " $(v)
	sed -i s/'"$(VERSION)"'/'"$(v)"'/ package.json

tag_and_push:
		git add --all
		git commit -a -m "Tag v $(v) $(m)"
		git tag v$(v)
		git push
		git push --tags

tag: update_version build tag_and_push		
		
release: update_version tag_and_push				



#jquery_es6:
	#grunt build:es6:*:-deprecated:-manipulation/_evalUrl:-exports/amd:-exports/global:-ajax/jsonp:-ajax/load:-ajax/parseXML:-ajax/script:-ajax/var/location:-ajax/var/nonce:-ajax/var/rquery
	#-effects:-effects/Tween:-effects/animatedSelector
	#jspm build jquery_shim dist/jquery.esm.js --skip-source-maps --skip-encode-names --format esm
