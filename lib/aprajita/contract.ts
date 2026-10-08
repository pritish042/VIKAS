import {z} from 'zod';
export const languages=['c','python','html','java'] as const;
export type LabLanguage=typeof languages[number];
export const labels:Record<LabLanguage,string>={c:'C',python:'Python',html:'HTML',java:'Java'};
export const filenames:Record<LabLanguage,string>={c:'main.c',python:'main.py',html:'index.html',java:'Main.java'};
export const templates:Record<LabLanguage,string>={c:'#include <stdio.h>\n\nint main(void) {\n    printf("Hello, APRAJITA!\\n");\n    return 0;\n}\n',python:'print("Hello, APRAJITA!")\n',html:'<!doctype html>\n<html lang="en">\n<head><meta charset="utf-8"><title>My page</title></head>\n<body>\n  <h1>Hello, APRAJITA!</h1>\n  <p>Try changing this page.</p>\n</body>\n</html>\n',java:'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, APRAJITA!");\n    }\n}\n'};
export const MAX_SOURCE=6000;
export const fileSchema=z.object({language:z.enum(languages),name:z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9][A-Za-z0-9_. -]*$/,'Use a simple file name without paths.'),source:z.string().max(MAX_SOURCE)}).strict();
export const runSchema=z.object({language:z.enum(['c','python','java']),source:z.string().min(1).max(MAX_SOURCE),stdin:z.string().max(1000).default('')}).strict();
export const readinessSchema=z.object({version:z.string().max(80),answers:z.array(z.enum(['a','b','c','d'])).length(5)}).strict();
export interface LabFile {id:string;language:LabLanguage;name:string;source:string;updatedAt:string}
export interface LabAccess {eligible:boolean;ready:boolean;reason:string;needsProfile:boolean;requiresAssessment:boolean;version:string}
export interface LabQuestion {id:string;prompt:string;options:{id:string;text:string}[]}
export interface QuizResult {score:number;passed:boolean;results:{id:string;correct:boolean;answer:string;explanation:string}[]}
export interface RunResult {status:string;output:string;error:string;truncated:boolean}
