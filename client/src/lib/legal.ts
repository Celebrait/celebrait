// client/src/lib/legal.ts
//
// Re-export only — the constants moved to shared/legal.ts so the server
// can print the same trader line (entity + postal address) in email
// footers. Edit THAT file; both legal pages and every email update.
export * from '@shared/legal';
