try {
  const savedTheme = localStorage.getItem('lottery-stats-theme')
  const theme = savedTheme === 'dark' ? 'dark' : 'light'
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  if (savedTheme === 'system')
    localStorage.setItem('lottery-stats-theme', 'light')
} catch {
  document.documentElement.dataset.theme = 'light'
  document.documentElement.style.colorScheme = 'light'
}
