/* Applies the saved (or system) theme before first paint to avoid a flash. */
try{var t=localStorage.getItem('habitly.theme');var dk=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(dk)document.documentElement.classList.add('dark');}catch(e){}
