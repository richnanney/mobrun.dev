/*
	Panels for mobrun.dev

	Clicking a nav icon whose link points at a panel (href="#about", "#posts", ...) opens that
	panel in the card under the icons, and the card grows or shrinks to fit it. Clicking the open
	icon again, or pressing Escape, closes the card. Links that don't point at a panel (an external
	URL, or a bare "#") behave like normal links.

	To add a panel: add an <article class="panel" id="something"> inside #content in index.html,
	and point a nav link at it with href="#something".
*/

(function () {

	'use strict';

	var main = document.getElementById('main'),
		header = document.getElementById('header'),
		card = document.getElementById('content');

	if (!main || !header || !card) { return; }

	var links = header.querySelectorAll('nav a[href^="#"]'),
		panels = card.querySelectorAll('.panel'),
		reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches,

		FADE = reduceMotion ? 0 : 250,	// ms. Matches the panel opacity transition in main.css.
		GROW = reduceMotion ? 0 : 500,	// ms. Matches the card height transition in main.css.
		GAP = 0.75,						// em. Matches "#content.is-open { margin-top }" in main.css.
		SPARE = 48,						// px kept free above and below the header.
		MIN_HEIGHT = 90,				// px. The card never gets squeezed smaller than this.

		current = null,					// the open panel, or null when the card is closed
		lastHeight = 0,					// the height the card was last told to animate to
		seq = 0,						// bumped on every open/close so stale timers can tell they're stale
		settleTimer;

	function getPanel(id) {
		for (var i = 0; i < panels.length; i++) {
			if (panels[i].id === id) { return panels[i]; }
		}
		return null;
	}

	function fromHash() {
		var panel = getPanel(window.location.hash.slice(1));
		return panel ? panel.id : null;
	}

	// The tallest the card can be while the title and icons stay on screen.
	function available() {
		var style = window.getComputedStyle(card),
			gap = parseFloat(style.fontSize) * GAP,
			lift = Math.abs(parseFloat(window.getComputedStyle(header).top)) || 0,	// the header sits this far above centre
			rest = header.offsetHeight - card.offsetHeight - parseFloat(style.marginTop);
		return Math.max(MIN_HEIGHT, main.clientHeight - rest - gap - SPARE - 2 * lift);
	}

	function setHeight(px) {
		px = Math.round(px);
		if (px !== lastHeight) {
			lastHeight = px;
			card.style.height = px + 'px';
			card.classList.remove('is-settled');
		}
		// Once it stops moving, let a card that is taller than the screen scroll.
		clearTimeout(settleTimer);
		if (px > 0 && !card.classList.contains('is-settled')) {
			settleTimer = setTimeout(function () { card.classList.add('is-settled'); }, GROW);
		}
	}

	function fit() {
		// Skip while a panel is still waiting to be swapped in: it is hidden, so it has no height to measure.
		if (current && current.classList.contains('is-active')) {
			setHeight(Math.min(current.offsetHeight, available()));
		}
	}

	function setNav(id) {
		for (var i = 0; i < links.length; i++) {
			var target = links[i].getAttribute('href').slice(1);
			if (!getPanel(target)) { continue; }
			var on = (target === id);
			links[i].classList.toggle('active', on);
			links[i].setAttribute('aria-expanded', on ? 'true' : 'false');
		}
	}

	function show(id) {
		var next = getPanel(id),
			prev = current,
			token;

		// Browsers fire both popstate and hashchange for one back-button press, so a repeat is normal.
		// Bail out before bumping seq, or the repeat would cancel the swap that is already waiting.
		if (next === prev) { fit(); return; }

		token = ++seq;
		current = next;
		setNav(next ? next.id : null);
		header.classList.toggle('has-panel', !!next);	// lets main.css tuck the title away on short screens

		// Close: fade the panel, shrink the card to nothing.
		if (!next) {
			prev.classList.remove('is-visible');
			card.classList.remove('is-open');
			setHeight(0);
			setTimeout(function () {
				if (token === seq) { prev.classList.remove('is-active'); }
			}, GROW);
			return;
		}

		// Open, or switch: swap panels, then animate the card to the new panel's height.
		function swap() {
			if (token !== seq) { return; }
			for (var i = 0; i < panels.length; i++) {
				if (panels[i] !== next) { panels[i].classList.remove('is-active', 'is-visible'); }
			}
			card.classList.remove('is-settled');	// measure without a scrollbar
			card.scrollTop = 0;
			next.classList.add('is-active');
			card.classList.add('is-open');
			fit();
			void next.offsetWidth;					// paint the panel at opacity 0 first, so it fades in
			next.classList.add('is-visible');
		}

		if (prev) {
			prev.classList.remove('is-visible');
			setTimeout(swap, FADE);
		} else {
			swap();
		}
	}

	// Open or close a panel, and record it in the address bar so the back button and shared links work.
	function go(id) {
		show(id);
		try {
			window.history.pushState(null, '', id ? '#' + id : window.location.pathname + window.location.search);
		} catch (e) { /* e.g. some file:// setups. Everything else still works. */ }
	}

	function onClick(event) {
		var id = this.getAttribute('href').slice(1);
		if (!getPanel(id)) { return; }
		event.preventDefault();
		go(current && current.id === id ? null : id);
	}

	for (var i = 0; i < links.length; i++) {
		var panel = getPanel(links[i].getAttribute('href').slice(1));
		if (!panel) { continue; }
		links[i].setAttribute('aria-controls', panel.id);
		links[i].setAttribute('aria-expanded', 'false');
		links[i].addEventListener('click', onClick);
	}

	window.addEventListener('popstate', function () { show(fromHash()); });
	window.addEventListener('hashchange', function () { show(fromHash()); });
	window.addEventListener('resize', fit);
	window.addEventListener('orientationchange', fit);

	document.addEventListener('keydown', function (event) {
		if (event.key === 'Escape' && current) { go(null); }
	});

	// A page opened at index.html#posts starts with that panel open.
	show(fromHash());

	// Web fonts can change how tall the text is once they arrive.
	if (document.fonts && document.fonts.ready) { document.fonts.ready.then(fit); }

})();
