<script lang="ts">
	import { onMount } from 'svelte';
	import { MoonIcon, SunIcon } from '@lucide/svelte';

	let isDark = $state(false);

	function syncTheme(dark: boolean, persist = true) {
		isDark = dark;
		document.documentElement.classList.toggle('dark', dark);
		document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
		document
			.querySelector('meta[name="theme-color"]')
			?.setAttribute('content', dark ? '#10151b' : '#f7f8fa');

		if (persist) localStorage.setItem('owkr-theme', dark ? 'dark' : 'light');
	}

	onMount(() => {
		isDark = document.documentElement.classList.contains('dark');
		const media = window.matchMedia('(prefers-color-scheme: dark)');
		const followSystemTheme = (event: MediaQueryListEvent) => {
			if (!localStorage.getItem('owkr-theme')) syncTheme(event.matches, false);
		};

		media.addEventListener('change', followSystemTheme);
		return () => media.removeEventListener('change', followSystemTheme);
	});
</script>

<button
	type="button"
	class="border-line bg-paper text-ink focus-visible:ring-navy fixed bottom-4 left-4 z-40 inline-flex size-10 items-center justify-center rounded-full border shadow-[0_6px_18px_rgba(17,24,32,0.12)] transition hover:-translate-y-px hover:shadow-[0_8px_22px_rgba(17,24,32,0.16)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
	aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
	aria-pressed={isDark}
	title={isDark ? '라이트 모드' : '다크 모드'}
	onclick={() => syncTheme(!isDark)}
>
	{#if isDark}
		<SunIcon class="size-[18px]" aria-hidden="true" />
	{:else}
		<MoonIcon class="size-[18px]" aria-hidden="true" />
	{/if}
</button>
