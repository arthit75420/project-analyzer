#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const glob = require("glob");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const xlsx = require("xlsx");
const cliProgress = require("cli-progress");

// ✅ รับ path จาก argument --path=...
const argPath = process.argv.find((arg) => arg.startsWith("--path="));
if (!argPath) {
  console.error("❌ กรุณาระบุ path โดยใช้ --path=... เช่น:");
  console.error("   project-analyzer --path=/your/project/path");
  process.exit(1);
}
const srcPath = argPath.replace("--path=", "").trim();

if (!fs.existsSync(srcPath) || !fs.statSync(srcPath).isDirectory()) {
  console.error(`❌ ไม่พบ path ที่ระบุ: ${srcPath}`);
  process.exit(1);
}

// ✅ นามสกุลที่ไม่ต้องวิเคราะห์
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

// ✅ Progress bar
const barAnalyzing = new cliProgress.SingleBar(
  {
    format: "Analyzing [{bar}] {percentage}% | {value}/{total} files",
    barCompleteChar: "\u2588",
    barIncompleteChar: "\u2591",
    hideCursor: true,
  },
  cliProgress.Presets.shades_classic
);

// ✅ Scan เฉพาะไฟล์ .js, .jsx, .ts, .tsx ยกเว้น node_modules, build, dist
const jsTsFiles = glob.sync(`${srcPath}/**/*.{js,jsx,ts,tsx}`, {
  ignore: [
    `${srcPath}/**/node_modules/**`,
    `${srcPath}/**/build/**`,
    `${srcPath}/**/dist/**`,
  ],
});

// ✅ Scan ios และ android ทุกไฟล์ ยกเว้น Pods/build
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

// ✅ เก็บผลลัพธ์
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
  totalLines += code.split(/\r?\n/).length;

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
  rootFoldersCount[topLevel] = (rootFoldersCount[topLevel] || 0) + 1;
});

barAnalyzing.stop();
console.log("📊 กำลังเขียนไฟล์รายงาน...");

// ✅ อ่าน package.json
let dependencies = [],
  devDependencies = [];
try {
  const pkgJson = JSON.parse(
    fs.readFileSync(path.join(srcPath, "package.json"), "utf8")
  );
  dependencies = Object.keys(pkgJson.dependencies || {});
  devDependencies = Object.keys(pkgJson.devDependencies || {});
} catch (e) {
  console.warn("⚠️ ไม่พบหรืออ่าน package.json ไม่ได้");
}

const result = {
  total_files: files.length,
  function_components: functionCount,
  class_components: classCount,
  total_characters: charCount,
  total_lines: totalLines,
  dependencies_count: dependencies.length,
  devDependencies_count: devDependencies.length,
  dependencies,
  devDependencies,
  parse_errors: parseErrors,
};

// ✅ เขียน JSON
fs.writeFileSync("project_analysis.json", JSON.stringify(result, null, 2));

// ✅ เขียน Excel
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
console.log("📁 ไฟล์ JSON และ Excel ถูกสร้างเรียบร้อยแล้ว");
console.log("📊 สรุปผลการวิเคราะห์:");
console.log(" - - - - - - - - - -");
console.log(`✅ - Total Files: ${result.total_files}`);
console.log(`✅ - Function Components: ${result.function_components}`);
console.log(`✅ - Class Components: ${result.class_components}`);
console.log(`✅ - Total Characters: ${result.total_characters}`);
console.log(`✅ - Total Lines of Code: ${result.total_lines}`);
console.log(`✅ - Dependencies: ${result.dependencies_count}`);
console.log(`✅ - Dev Dependencies: ${result.devDependencies_count}`);
if (result.parse_errors.length > 0) {
  console.log(`⚠️  - Parse Errors: ${result.parse_errors.length}`);
}
console.log(" - - - - - - - - - -");
console.log("📂 ไฟล์รายงานถูกสร้างในรูปแบบ JSON และ Excel");
console.log("🎉 ขอบคุณที่ใช้ Project Analyzer!");
