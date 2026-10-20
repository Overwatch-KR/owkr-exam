<script lang="ts">
	import { Select } from 'bits-ui';
	import { CheckIcon, ChevronDownIcon } from '@lucide/svelte';

	let {
		value = $bindable(''),
		label,
		options
	}: {
		value?: string;
		label: string;
		options: { value: string; label: string }[];
	} = $props();
</script>

<div class="text-xs font-semibold">
	<span aria-hidden="true">{label}</span>
	<Select.Root type="single" bind:value items={options} allowDeselect={false}>
		<Select.Trigger
			aria-label={label}
			class="btn-secondary mt-2 flex min-w-32 justify-between gap-4 focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] focus-visible:outline-none"
		>
			{options.find((option) => option.value === value)?.label ?? '선택하세요'}
			<ChevronDownIcon class="size-4" />
		</Select.Trigger>
		<Select.Portal>
			<Select.Content
				sideOffset={4}
				align="start"
				class="border-line text-ink z-[80] max-h-[var(--bits-select-content-available-height)] min-w-[var(--bits-select-anchor-width)] overflow-y-auto rounded-md border bg-[var(--app-surface)] p-1 shadow-lg outline-none"
			>
				<Select.Viewport>
					{#each options as option (option.value)}
						<Select.Item
							value={option.value}
							label={option.label}
							class="flex cursor-pointer items-center justify-between gap-4 rounded-sm px-3 py-2 text-sm outline-none data-highlighted:bg-[var(--app-accent-soft)] data-highlighted:text-[var(--app-accent)] data-selected:font-semibold"
						>
							{option.label}
							<CheckIcon
								class="size-4"
								style={`visibility: ${value === option.value ? 'visible' : 'hidden'}`}
							/>
						</Select.Item>
					{/each}
				</Select.Viewport>
			</Select.Content>
		</Select.Portal>
	</Select.Root>
</div>
