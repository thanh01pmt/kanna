#!/usr/bin/env node
import { Command } from "commander"
import * as fs from "fs"
import * as path from "path"
import { extractWorkflowFromMarkdown } from "./extractor"
import { WorkflowManifestSchema } from "@kanna/shared/workflow-schema"

const program = new Command()

program
  .name("workflow-extractor")
  .description("Statically extract Kanna Workflow Manifests from Markdown documentation")
  .version("0.1.0")

program
  .command("extract")
  .description("Extract workflow definition from a markdown file")
  .requiredOption("-f, --file <path>", "Path to the workflow markdown file")
  .option("-o, --output <path>", "Path to save the JSON manifest output")
  .option("--pretty", "Pretty print JSON output")
  .action((options) => {
    const filePath = path.resolve(options.file)
    if (!fs.existsSync(filePath)) {
      console.error(`Error: File not found at ${filePath}`)
      process.exit(1)
    }

    try {
      const content = fs.readFileSync(filePath, "utf-8")
      const manifest = extractWorkflowFromMarkdown(content)

      // Validate against the Zod schema
      const validationResult = WorkflowManifestSchema.safeParse(manifest)
      if (!validationResult.success) {
        console.error("Validation failed for the extracted manifest:")
        console.error(JSON.stringify(validationResult.error.format(), null, 2))
        process.exit(1)
      }

      const outputData = JSON.stringify(validationResult.data, null, options.pretty ? 2 : 0)

      if (options.output) {
        const outputPath = path.resolve(options.output)
        fs.writeFileSync(outputPath, outputData, "utf-8")
        console.log(`Successfully exported workflow manifest to ${outputPath}`)
      } else {
        console.log(outputData)
      }
    } catch (err: any) {
      console.error(`Execution failed: ${err.message}`)
      process.exit(1)
    }
  })

program.parse(process.argv)
