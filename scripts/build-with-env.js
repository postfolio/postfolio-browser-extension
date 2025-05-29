#!/usr/bin/env node

// Build script for handling environment-specific Firebase configs
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Read environment variables or use defaults
const config = {
  FIREBASE_API_KEY: process.env.FIREBASE_API_KEY || 'AIzaSyCJnEFDnw9Urckdcfmpmjh-B1h8IMYe6NI',
  FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN || 'postfolio-web-app-dev.firebaseapp.com',
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'postfolio-web-app-dev',
  FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET || 'postfolio-web-app-dev.appspot.com',
  FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID || '887681121025',
  FIREBASE_APP_ID: process.env.FIREBASE_APP_ID || '1:887681121025:web:24db111d26485f8b057900',
  FIREBASE_MEASUREMENT_ID: process.env.FIREBASE_MEASUREMENT_ID || 'G-V1YN9NHPF0'
};

// Read template
const templatePath = path.join(__dirname, '..', 'firebase-config.template.ts');
const outputPath = path.join(__dirname, '..', 'firebase-config.ts');
let template = fs.readFileSync(templatePath, 'utf8');

// Replace placeholders
Object.entries(config).forEach(([key, value]) => {
  template = template.replace(`__${key}__`, value);
});

// Write output
fs.writeFileSync(outputPath, template);
console.log('✅ Generated firebase-config.ts with environment variables');

// Run the actual build
console.log('🏗️  Building extension...');
execSync('npm run build', { stdio: 'inherit' });

console.log('✅ Build complete!'); 