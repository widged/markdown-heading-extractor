const vfile = require("to-vfile");
const report = require("vfile-reporter");
const unified = require("unified");
const markdown = require("remark-parse");
const html = require("remark-html");
const highlight = require("remark-highlight.js");
const codeExtra = require("remark-code-extra");
const visit = require("unist-util-visit");
var path = require("path");
var walk = require("walk");
var fs = require("fs");

// const WALKPATH = "/Users/marielle/Documents/Daily/__knowledge-md/flow/store";
const WALKPATH = "/Users/marielle/Downloads/foam-master/docs";
const Datastore = require("nedb");

const db = new Datastore({
  filename: path.resolve(__dirname, "markdown.db"),
  autoload: true
});

const miniPlug = function(options) {
  const settings = options || {};

  function transformer(tree) {
    visit(tree, node => {
      if (node.type === "heading") {
        // console.log(node);
        const titleDoc = node;
        if (typeof settings.async === "function") {
          const text = node.children
            .map(d => {
              return d.value;
            })
            .join(" ")
            .replace(/^ +$/g, "");
          const url = node.children
            .map(d => {
              return d.url;
            })
            .join(" ")
            .replace(/^ +$/g, "");

          if (text.length || url.length) {
            settings.async({
              name: text ? text : undefined,
              type: "heading",
              depth: node.depth,
              url: url ? url : undefined,
              line: node.position.start.line
            });
          }
        }
      } else if (
        node.type === "code" &&
        ["topic", "frontmatter"].includes(node.lang)
      ) {
        const frontmatter = node.value.split("\n").reduce((acc, d) => {
          const [k, v] = d.split(/: */);
          acc[k] = v;
          return acc;
        }, {});

        if (typeof settings.async === "function") {
          settings.async({ type: "frontmatter", ...frontmatter });
        }
      } else {
      }
      return node;
    });
  }

  return transformer;
};

var walker;
// var walkPath = "/Users/marielle/Documents/Daily/__knowledge-md/1/";
const walkPath = WALKPATH;

walker = walk.walk(walkPath, {
  followLinks: false,
  // directories with these keys will be skipped
  filters: ["Smurffffffff"]
});

let qty = 0;

walker.on("file", function(root, fileStats, next) {
  const filePath = path.resolve(root, fileStats.name);
  const fileBase = fileStats.name.replace(/\.md$/, "");
  const m = filePath.match(/\.md$/);
  if (!m) {
    next();
    return;
  }
  qty++;
  if (qty % 100 === 0) {
    console.log(qty);
  }
  const rootPath = root.replace(walkPath, "");
  // console.log("++", filePath);
  // console.log("--", rootPath);
  // console.log("--------------");

  db.insert(
    {
      p: rootPath,
      md: fileBase,
      name: "_:" + fileBase.replace(/_/g, " "),
      tags: ["admin:filename"]
    },
    (err, newDoc) => {
      const docId = newDoc._id;
      unified()
        .use(markdown)
        .use(miniPlug, {
          async: doc => {
            db.insert({
              p: rootPath, // filePath.replace(walkPath, ""),
              md: fileBase,
              name: doc.name || "...",
              fileId: newDoc._id,
              ...doc
            });
          }
        })
        .use(html)
        .process(vfile.readSync(filePath), (err, file) => {});

      next();
    }
  );
});

walker.on("directories", function(root, dirStatsArray, next) {
  next();
});

walker.on("errors", function(root, nodeStatsArray, next) {
  next();
});

walker.on("end", function() {
  console.log("all done");
});
