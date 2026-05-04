#!/usr/bin/env bun

import * as readline from "node:readline"
import { handleWorkerTaskLine } from "./benchmark-child/handleWorkerTaskLine"

const reader = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
})

reader.on("line", handleWorkerTaskLine)
