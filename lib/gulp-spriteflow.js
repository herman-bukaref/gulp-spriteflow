/**
 * @file
 * JavaScript Language file
 * gulp-spriteflow.
 * Created by PhpStorm on 13.06.17
 *
 * @author Herman Bukaref
 * @version $FOUNDRY_VERSION
 */


var through2    = require('through2').obj;
var _           = require("underscore");
var Path        = require("path");
var gutil       = require("gulp-util");
var eachAsync   = require("each-async");
var Spritesmith = require("spritesmith");
var styleTpl    = require("spritesheet-templates");

function FormatByExt() {
  this.formats = {};
}

FormatByExt.prototype = {
  add: function (ext, format) {
    this.formats[ext] = format;
  },
  get: function (filepath) {
    var path = filepath || 'default';
    var ext  = Path.extname(path).toLowerCase();

    return this.formats[ext];
  }
};

var engAutoFormat  = new FormatByExt();
var imgAutoFormat  = new FormatByExt();
var stylAutoFormat = new FormatByExt();

engAutoFormat.add('.png', 'img');
engAutoFormat.add('.jpg', 'img');
engAutoFormat.add('.jpeg', 'img');
engAutoFormat.add('.svg', 'svg');

imgAutoFormat.add('.png', 'png');
imgAutoFormat.add('.jpg', 'jpeg');
imgAutoFormat.add('.jpeg', 'jpeg');
imgAutoFormat.add('.svg', 'svg');

stylAutoFormat.add('.styl', 'stylus');
stylAutoFormat.add('.stylus', 'stylus');
stylAutoFormat.add('.sass', 'sass');
stylAutoFormat.add('.scss', 'scss');
stylAutoFormat.add('.less', 'less');
stylAutoFormat.add('.json', 'json');
stylAutoFormat.add('.css', 'css');

// default Img Spritsheet Generator
function IMGspriteEngine(params) {
  var defaultImgParams   = {
    name   : params.name + '.png',
    engine : 'pixelsmith',
    padding: 0
  };
  var defaultStyleParams = {};

  params.img   = _.extend({}, defaultImgParams, params.img);
  params.style = _.extend({}, defaultStyleParams, params.style);

  params.style.format = params.style.format || stylAutoFormat.get(params.style.name) || 'css';
  params.style.name   = params.style.name || params.name + '.' + params.style.format;

  this.params = params;
  this.eng    = new Spritesmith(params.img);
  this.items  = [];
}

IMGspriteEngine.prototype = {
  addItem: function (item) {
    this.items.push(item);
  },

  createSpritesheet: function (mainStream, allDone) {
    var self = this;

    self.eng.createImages(self.items, function handleImages(err, images) {
      var result = self.eng.processImages(images, self.params.img);

      // generate spritesheet
      var spritesheetStream = new gutil.File({
        path    : './' + self.params.img.name,
        contents: result.image
      });

      mainStream.push(spritesheetStream);

      // generate stylesheet
      var Style      = {
        sprites         : [],
        spritesheet     : {
          width : result.properties.width,
          height: result.properties.height,
          image : (self.params.img.rel || self.params.rel || '') + self.params.img.name
        },
        spritesheet_info: {
          name: self.params.flow
        }
      };
      var imagePaths = Object.getOwnPropertyNames(result.coordinates).sort();

      eachAsync(imagePaths, function (imagePath, index, styleDone) {
        var Image = result.coordinates[imagePath];

        Image.name     = Path.parse(imagePath).name;
        Image.src_path = imagePath;

        Style.sprites.push(Image);
        styleDone();
      }, function () {
        var styleStr         = styleTpl(Style, self.params.style);
        var stylesheetStream = new gutil.File({
          path    : './' + self.params.style.name,
          contents: new Buffer(styleStr)
        });

        mainStream.push(stylesheetStream);
        allDone();
      });
    })
  }
};

// default Svg Spritsheet Generator
function SVGspriteEngine(params) {
  var defaultSvgParams   = {
    name: params.name + '.svg'
  };
  var defaultStyleParams = {};

  params.svg   = _.extend({}, defaultSvgParams, params.svg);
  params.style = _.extend({}, defaultStyleParams, params.style);

  params.style.format = params.style.format || stylAutoFormat.get(params.style.name) || 'css';
  params.style.name   = params.style.name || params.name + '.' + params.style.format;

  this.params = params;
  // this.eng    = new svgSprite();
}

SVGspriteEngine.prototype = {
  addItem: function (item) {
  },

  createSpritesheet: function (mainStream, allDone) {
    allDone(new Error('Svg Engine Not Working yet. Follow for module updates.'));
  }
};

// sprite engines manager
function SpriteEngines() {
  this.engines = {};
}

SpriteEngines.prototype = {
  add: function (name, engObj) {
    this.engines[name] = engObj;
  },
  get: function (engName) {
    return this.engines[engName];
  }
};

var spriteEngines = new SpriteEngines();

spriteEngines.add('img', IMGspriteEngine);
spriteEngines.add('svg', SVGspriteEngine);

function spriteflowName(options) {
  return [
    options.eng,
    options.rel,
    options.name
  ].join('/').replace('//', '/');
}

function removeFileFromStream(cb) {
  cb();
}

function spriteflow(opts) {
  var spriteFlows = [];
  var flowEngines = {};

  var toSpriteFlows = function (file, enc, toNext) {
    var defaultOptions = {
      name  : 'sprites',
      eng   : engAutoFormat.get(file.path),
      img   : {},
      svg   : {},
      style : {},
      rel   : '',
      stream: removeFileFromStream
    };

    var fileOpts = typeof opts === 'function' ? opts(file) : opts;

    fileOpts = typeof fileOpts === 'undefined' ? {} : fileOpts;

    var options = _.extend({}, defaultOptions, fileOpts);

    options.flow = options.flow || spriteflowName(options);

    if (typeof flowEngines[options.flow] === 'undefined') {
      var Eng = spriteEngines.get(options.eng);

      spriteFlows.push(options.flow);
      flowEngines[options.flow] = new Eng(options);
    }

    flowEngines[options.flow].addItem(file);

    options.stream(toNext, file);
  };

  var toMainStream = function (allDone) {
    var mainStream = this;

    eachAsync(spriteFlows,
      function (flow, index, flowDone) {
        flowEngines[flow].createSpritesheet(mainStream, flowDone);
      }, function (err) {
        mainStream.push(null);
        allDone(err);
      }
    );
  };

  return through2(toSpriteFlows, toMainStream);
}

module.exports        = spriteflow;
module.exports.addEng = function (name, engObj) {};