var rerendered = 0;
var tags_map = {};
var slug = require('github-slugid');
var eol = require('os').EOL;
var fs = require('fs');
var color = require('bash-color');

function replacer(tagsHtml, rendered) {
  return tagsHtml
    .toString('utf8')
    .replace(
      /.section class="normal markdown-section"(.|\n)*\/section./,
      "<section class=\"normal markdown-section\">" +
      "<h1>Тэги</h1>" +
      rendered +
      "</section>"
    );
}

module.exports = {
  book: {
    assets: './assets',
    css: [
      "plugin.css"
    ]
  },
  hooks: {
    "init": function() {
      tags_map = {};
    },

    "page:before": function(page) {
      if (this.output.name != 'website') return page;

      // extract tags from page or YAML
      var rawtags = '';
      if (page.tags) {
        // extract from YAML
        rawtags = page.tags;
      } else {
        // extract from page
        page.content = page.content.concat(eol);  // prevent no end of line
        var _tag_exist = page.content.match(/^\s*tags:\s*\[*(.*?)\]*$/im);
        if (!_tag_exist) return page;
        rawtags = _tag_exist[1];
      }

      // process both YAML and RegExp string
      rawtags = ('' + rawtags).split(',');
      var tags = [];
      rawtags.forEach(function(e) {
        var tags_ = e.match(/^\s*['"]*\s*(.*?)\s*['"]*\s*$/)[1];
        if (tags_) tags.push(tags_);
      })

      // push to tags_map
      tags.forEach(function(e) {
        if (!tags_map[e]) tags_map[e] = [];
        tags_map[e].push({
          url: page.path,
          title: page.title
        });
      })

      // generate tags before html
      var tags_before_ = [];
      tags.forEach(function(e) {
        if (page.type === 'markdown') {
          tags_before_.push('[' + e + ']' + '(' + '/tags.html#' + slug(e) + ')');
        } else {
          tags_before_.push('link:/tags.html#' + slug(e) + '[' + e + ']');
        }
      })
      if (page.type === 'markdown') {
        var tags_before = eol + '<i class="fa fa-tags" aria-hidden="true"></i> ' + tags_before_.join(' ') + eol;
      } else {
        var tags_before = eol + '*ADOCTAGS* ' + tags_before_.join(' ') + eol;
      }

      // override raw tags in page
      page.content = page.content.replace(/^\s?tags:\s?\[?(.*?)\]?$/im, eol);
      // replace tags info from page and YAML
      var tags_format = eol.concat(eol, 'tagsstart', eol, tags_before, eol, 'tagsstop', eol);
      var placement = this.config.get('pluginsConfig.tags.placement') || 'top';
      if (placement === 'bottom') {
        page.content = page.content.concat(tags_format);
      } else {
        if (page.type === 'markdown') {
          page.content = page.content.replace(/^#\s*(.*?)$/m, '#$1' + tags_format);
        } else {
          page.content = page.content.replace(/^=\s*(.*?)$/m, '=$1' + tags_format);
        }
      }
      return page;
    },

    "page": function(page) {
      // add tags id and class
      page.content = page.content.replace(/(<div class="paragraph">)?\s*<p>tagsstart<\/p>\s*(<\/div>)?/, '<!-- tags --><div id="tags" class="tags">');
      page.content = page.content.replace(/(<div class="paragraph">)?\s*<p>tagsstop<\/p>\s*(<\/div>)?/, '</div><!-- tagsstop -->');
      page.content = page.content.replace('<strong>ADOCTAGS</strong>', '<i class="fa fa-tags" aria-hidden="true"></i> ');
      return page;
    },

    "finish": function() {
      var content = '';

      for (var key in tags_map) {
        if (tags_map.hasOwnProperty(key)) {
          var tag_header = eol.concat('## ', key, eol);
          content = content.concat(tag_header);
          tags_map[key].forEach(function(e) {
            var tag_body = eol.concat('- ', '[', e.title, ']', '(', e.url, ')');
            content = content.concat(tag_body);
          })
          content = content.concat(eol);
        }
      }

      var output = this.output.resolve('tags.html');
      var write = this.output.writeFile;
      var toUrl = this.output.toURL;

      if (rerendered === 1) {
        rerendered = 2;
        console.log(color.red('warn: ') +
          'Tags auto-regeneration disabled in gitbook-serve mode for more performance. Restart server for generating new tags page!');
      }

      return rerendered > 0 ? null : this.book.renderBlock('markdown', content)
        .then(function(rendered) {
          var tagsHtml = fs.readFileSync(output);
          var linked = rendered.replace(
            /a href=\"(.*)\"/ig,
            function(_, link) {
              return 'a href="' + toUrl(link) + '"';
            })
          rerendered = 1;
          return write('tags.html', replacer(tagsHtml, linked));
        });
    }
  }
};
