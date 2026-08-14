<script lang="ts">
	import {
		CircleCheckIcon,
		CircleXIcon,
		InfoIcon,
		LoaderCircleIcon,
		TriangleAlertIcon
	} from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { Toaster as Sonner, type ToasterProps } from 'svelte-sonner';

	let { ...restProps }: ToasterProps = $props();
	let theme = $state<'light' | 'dark'>('light');

	onMount(() => {
		const root = document.documentElement;
		const updateTheme = () => (theme = root.classList.contains('dark') ? 'dark' : 'light');
		const observer = new MutationObserver(updateTheme);

		updateTheme();
		observer.observe(root, { attributes: true, attributeFilter: ['class'] });
		return () => observer.disconnect();
	});
</script>

<Sonner
	{theme}
	position="top-center"
	closeButton
	expand
	richColors={false}
	duration={4200}
	toastOptions={{
		class:
			'rounded-2xl! border-[#e5e8eb]! bg-white/95! px-4! py-3.5! shadow-[0_12px_32px_rgba(25,31,40,0.14)]! backdrop-blur-xl!'
	}}
	containerAriaLabel="알림"
	closeButtonAriaLabel="알림 닫기"
	{...restProps}
>
	{#snippet loadingIcon()}
		<LoaderCircleIcon class="size-4 animate-spin text-[#3182f6]" />
	{/snippet}
	{#snippet successIcon()}
		<CircleCheckIcon class="size-4 text-[#3182f6]" />
	{/snippet}
	{#snippet errorIcon()}
		<CircleXIcon class="size-4 text-[#e5484d]" />
	{/snippet}
	{#snippet infoIcon()}
		<InfoIcon class="size-4 text-[#3182f6]" />
	{/snippet}
	{#snippet warningIcon()}
		<TriangleAlertIcon class="size-4 text-[#f59e0b]" />
	{/snippet}
</Sonner>
