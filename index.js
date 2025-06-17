const fs = require("fs");
const path = require("path");
const glob = require("glob");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const xlsx = require("xlsx");
const cliProgress = require("cli-progress");

const ignoredExtensions = [
  ".png",
  ".wav",
  ".ttf",
  ".plist",
  ".storyboard",
  ".xcworkspacedata",
  ".xcscheme",
  ".xcuserstate",
  ".keystore",
  ".jar",
  ".lock",
  ".bzl",
  ".properties",
];

const barAnalyzing = new cliProgress.SingleBar(
  {
    format: "Analyzing [{bar}] {percentage}% | {value}/{total} files",
    barCompleteChar: "\u2588",
    barIncompleteChar: "\u2591",
    hideCursor: true,
  },
  cliProgress.Presets.shades_classic
);

const srcPath = "/Users/7p110058/Works/BAY/frontend-mobile-app-rn";
const jsTsFiles = glob.sync(`${srcPath}/**/*.{js,jsx,ts,tsx}`, {
  ignore: [
    `${srcPath}/**/node_modules/**`,
    `${srcPath}/**/build/**`,
    `${srcPath}/**/dist/**`,
  ],
});

const iosAndroidFiles = glob.sync(`${srcPath}/+(ios|android)/**/*`, {
  ignore: [
    `${srcPath}/ios/build/**`,
    `${srcPath}/ios/Pods/**`,
    `${srcPath}/android/.gradle/**`,
    `${srcPath}/android/build/**`,
    `${srcPath}/android/app/build/**`,
  ],
});

const files = [...jsTsFiles, ...iosAndroidFiles];
barAnalyzing.start(files.length, 0);

const rootFoldersCount = {};
let functionCount = 0;
let classCount = 0;
let charCount = 0;
let totalLines = 0;
const parseErrors = [];

function analyzeFile(filePath) {
  if (!fs.statSync(filePath).isFile()) return;

  const ext = path.extname(filePath).toLowerCase();
  if (ignoredExtensions.includes(ext)) return;

  const code = fs.readFileSync(filePath, "utf8");
  charCount += code.length;
  totalLines += code.split(/\r?\n/).length; // ✅ นับบรรทัดเอง

  try {
    const ast = parser.parse(code, {
      sourceType: "module",
      plugins: [
        "jsx",
        "typescript",
        "classProperties",
        "objectRestSpread",
        "optionalChaining",
        "nullishCoalescingOperator",
        "decorators-legacy",
        "exportDefaultFrom",
        "dynamicImport",
        "topLevelAwait",
      ],
      allowDeclareFields: true,
    });

    traverse(ast, {
      FunctionDeclaration(path) {
        functionCount++;
      },
      ArrowFunctionExpression(path) {
        const isComponent =
          path.parent.type === "VariableDeclarator" &&
          /^[A-Z]/.test(path.parent.id.name);
        if (isComponent) functionCount++;
      },
      ClassDeclaration(path) {
        if (
          path.node.superClass &&
          ["Component", "React.Component"].includes(path.node.superClass.name)
        ) {
          classCount++;
        }
      },
    });
  } catch (err) {
    parseErrors.push({ file: filePath, message: err.message });
  }
}

files.forEach((filePath, index) => {
  analyzeFile(filePath);
  barAnalyzing.update(index + 1);
});

files.forEach((filePath) => {
  const relative = path.relative(srcPath, filePath);
  const topLevel = relative.split(path.sep)[0];
  if (!topLevel || topLevel === "node_modules") return;
  if (!rootFoldersCount[topLevel]) rootFoldersCount[topLevel] = 0;
  rootFoldersCount[topLevel]++;
});

barAnalyzing.stop();
console.log("กำลังเขียนไฟล์รายงานผลการวิเคราะห์โปรเจกต์...");

// Read dependencies
const pkgJson = JSON.parse(fs.readFileSync(`${srcPath}/package.json`, "utf8"));
const dependencies = Object.keys(pkgJson.dependencies || {});
const devDependencies = Object.keys(pkgJson.devDependencies || {});

const result = {
  total_files: files.length,
  function_components: functionCount,
  class_components: classCount,
  total_characters: charCount,
  total_lines: totalLines,
  dependencies_count: dependencies.length,
  devDependencies_count: devDependencies.length,
  dependencies: dependencies,
  devDependencies: devDependencies,
  parse_errors: parseErrors,
};

// Write to JSON
fs.writeFileSync("project_analysis.json", JSON.stringify(result, null, 2));

// Write to XLSX
const workbook = xlsx.utils.book_new();
const summarySheet = xlsx.utils.aoa_to_sheet([
  ["Metric", "Value"],
  ["Total Files", result.total_files],
  ["Function Components", result.function_components],
  ["Class Components", result.class_components],
  ["Total Characters", result.total_characters],
  ["Total Lines of Code", result.total_lines],
  ["Dependencies", result.dependencies_count],
  ["Dev Dependencies", result.devDependencies_count],
  [],
  ["Files by Root Folder", "Count"],
  ...Object.entries(rootFoldersCount),
]);

const depsSheet = xlsx.utils.aoa_to_sheet([
  ["Dependency Type", "Name"],
  ...dependencies.map((d) => ["dependency", d]),
  ...devDependencies.map((d) => ["devDependency", d]),
]);

const errorsSheet = xlsx.utils.aoa_to_sheet([
  ["File", "Error Message"],
  ...parseErrors.map((e) => [e.file, e.message]),
]);

xlsx.utils.book_append_sheet(workbook, summarySheet, "Summary");
xlsx.utils.book_append_sheet(workbook, depsSheet, "Dependencies");
xlsx.utils.book_append_sheet(workbook, errorsSheet, "Parse Errors");
xlsx.writeFile(workbook, "project_analysis.xlsx");

console.log(
  "✅ วิเคราะห์โปรเจกต์เสร็จแล้ว: project_analysis.json / project_analysis.xlsx"
);
