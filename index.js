const fs = require("fs");
const path = require("path");
const glob = require("glob");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const xlsx = require("xlsx");
const { execSync } = require("child_process");

const srcPath = "/Users/7p110058/Works/BAY/frontend-mobile-app-rn";
const files = glob.sync(`${srcPath}/**/*.{js,jsx,ts,tsx}`);

let functionCount = 0;
let classCount = 0;
let charCount = 0;
let totalLines = 0;

function analyzeFile(filePath) {
  const code = fs.readFileSync(filePath, "utf8");
  charCount += code.length;

  const ast = parser.parse(code, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
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
}

files.forEach(analyzeFile);

// Run cloc to get line count
const clocOutput = execSync(`npx cloc ${srcPath} --json`).toString();
const clocJson = JSON.parse(clocOutput);
totalLines = clocJson?.SUM?.code || 0;

// Read dependencies
const pkgJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
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
]);

const depsSheet = xlsx.utils.aoa_to_sheet([
  ["Dependency Type", "Name"],
  ...dependencies.map((d) => ["dependency", d]),
  ...devDependencies.map((d) => ["devDependency", d]),
]);

xlsx.utils.book_append_sheet(workbook, summarySheet, "Summary");
xlsx.utils.book_append_sheet(workbook, depsSheet, "Dependencies");
xlsx.writeFile(workbook, "project_analysis.xlsx");

console.log(
  "✅ วิเคราะห์โปรเจกต์เสร็จแล้ว: project_analysis.json / project_analysis.xlsx"
);
