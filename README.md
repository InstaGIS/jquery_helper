
## jQuery Helper

This helper bundles jQuery library plus all the jQuery and jQuery-UI plugins our app uses
 in a single monolithic file. 

### Installation

Install it as a drop-in replacement of jQuery like so:

```
jspm install jquery=github:huasofoundries/jquery_helper
```

Or (in case you're not into jspm) just copy `dist/jquery_helper.js` to your project.


### Building

If you change anything in `src/jquery_helper.js` remember to update the build like so:


```sh
make build
```

### Credits

I'm afraid I had to add a couple of dependencies to version control, 
because the original packages relied in jQuery as a global object and
I didn't want to resort to that.

- [jquery-ui-rotatable](https://github.com/godswearhats/jquery-ui-rotatable)
- [jquery-hotkeys](https://github.com/tzuryby/jquery.hotkeys)

