const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const frontendDir = path.resolve(__dirname, '../../frontend');
const backendPublic = path.resolve(__dirname, '../public');

if (fs.existsSync(frontendDir)) {
  console.log('[Build] Building frontend from:', frontendDir);
  try {
    execSync('npm install', { cwd: frontendDir, stdio: 'inherit' });
    execSync('npm run build', { cwd: frontendDir, stdio: 'inherit' });

    const frontendDist = path.join(frontendDir, 'dist');
    if (fs.existsSync(frontendDist)) {
      console.log('[Build] Copying frontend build to backend/public...');
      fs.cpSync(frontendDist, backendPublic, { recursive: true, force: true });
      console.log('[Build] Frontend build successfully synced to backend/public!');
    }
  } catch (err) {
    console.warn('[Build] Warning: Frontend build encountered an error, falling back to existing assets:', err.message);
  }
} else {
  console.log('[Build] Frontend directory not found, using pre-packaged assets in backend/public.');
}
