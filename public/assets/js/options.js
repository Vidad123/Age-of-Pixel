document.addEventListener('DOMContentLoaded', () => {
  const roots = document.querySelectorAll('[data-game-options]');
  if (!roots.length || !window.AOPSettings) return;

  const template = `
    <div class="option-section">
      <h3>Sound</h3>
      <label class="option-toggle"><span><b>Music</b><small>Play enabled theme tracks in random order.</small></span><input data-setting="musicEnabled" type="checkbox"></label>
      <label class="option-range"><span>Music volume <output data-output="musicVolume"></output></span><input data-setting="musicVolume" type="range" min="0" max="1" step="0.05"></label>
      <label class="option-toggle"><span><b>Sound effects</b><small>Menu and battle feedback sounds.</small></span><input data-setting="soundEffectsEnabled" type="checkbox"></label>
      <label class="option-range"><span>Effects volume <output data-output="soundEffectsVolume"></output></span><input data-setting="soundEffectsVolume" type="range" min="0" max="1" step="0.05"></label>
      <label class="option-range"><span>Master volume <output data-output="masterVolume"></output></span><input data-setting="masterVolume" type="range" min="0" max="1" step="0.05"></label>
    </div>
    <div class="option-section option-grid">
      <label><span><b>Graphics quality</b><small>Lower quality improves mobile performance.</small></span><select data-setting="graphicsQuality"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
      <label><span><b>Animation speed</b><small>Controls battle and menu motion.</small></span><select data-setting="animationSpeed"><option value="slow">Slow</option><option value="normal">Normal</option><option value="fast">Fast</option></select></label>
      <label><span><b>UI scale</b><small>Resize menus, labels, and controls.</small></span><select data-setting="uiScale"><option value="small">Small</option><option value="normal">Normal</option><option value="large">Large</option></select></label>
    </div>
    <div class="option-danger">
      <div><b>Saved games</b><small>Remove every saved battle from this device. Custom troops, maps, and options stay.</small></div>
      <button type="button" data-clear-saves>Clear Saved Games</button>
    </div>
    <p class="option-status" role="status" aria-live="polite"></p>`;

  function populate(root) {
    root.innerHTML = template;
    const settings = window.AOPSettings.get();
    root.querySelectorAll('[data-setting]').forEach(control => {
      const key = control.dataset.setting;
      if (control.type === 'checkbox') control.checked = Boolean(settings[key]);
      else control.value = settings[key];
      const refreshOutput = () => {
        const output = root.querySelector(`[data-output="${key}"]`);
        if (output) output.textContent = Math.round(Number(control.value) * 100) + '%';
      };
      refreshOutput();
      control.addEventListener('input', () => {
        const value = control.type === 'checkbox' ? control.checked : control.type === 'range' ? Number(control.value) : control.value;
        window.AOPSettings.save({ [key]: value });
        if (key === 'musicEnabled' && value) window.AOPAudio?.unlock();
        refreshOutput();
      });
    });

    root.querySelector('[data-clear-saves]').addEventListener('click', () => {
      if (!confirm('Clear every saved Age of Pixel battle on this device?')) return;
      Object.keys(localStorage).filter(key => key.startsWith('ageofpixel-game-') || key === 'ageofpixel-active-match').forEach(key => localStorage.removeItem(key));
      const status = root.querySelector('.option-status');
      status.textContent = 'All saved battles were cleared.';
      window.dispatchEvent(new CustomEvent('aop-saves-cleared'));
    });
  }

  roots.forEach(populate);
});
