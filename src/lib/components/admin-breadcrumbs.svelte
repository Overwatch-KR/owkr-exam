<script lang="ts">
	type BreadcrumbItem = {
		label: string;
		href?: string;
		reload?: boolean;
		onclick?: (event: MouseEvent) => void;
	};

	let { items }: { items: BreadcrumbItem[] } = $props();
</script>

<nav class="pt-7" aria-label="현재 위치">
	<ol class="flex min-w-0 items-center gap-2 text-xs text-[#6a7684]">
		{#each items as item, index}
			<li class="flex min-w-0 items-center gap-2">
				{#if index > 0}
					<svg viewBox="0 0 12 12" class="h-3 w-3 shrink-0" fill="none" aria-hidden="true">
						<path
							d="m4.5 2.5 3.25 3.5-3.25 3.5"
							stroke="currentColor"
							stroke-width="1.25"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				{/if}
				{#if item.href}
					<a
						href={item.href}
						onclick={item.onclick}
						data-sveltekit-reload={item.reload || undefined}
						class="truncate font-medium hover:text-[#087ba8] hover:underline hover:underline-offset-4"
					>
						{item.label}
					</a>
				{:else}
					<span class="truncate font-semibold text-[#111820]" aria-current="page">{item.label}</span
					>
				{/if}
			</li>
		{/each}
	</ol>
</nav>
