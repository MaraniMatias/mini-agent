---
name: run-script
description: "Runs a shell command in the project directory and uses the output to complete the task"
tools:
  - run_command
  - read_file
---

When you need to execute something in the project, use the run_command tool.
Use the output of the command to inform the next step.
If the command fails, report the error clearly and do not proceed.
