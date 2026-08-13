<script lang="ts">
	let {
		toast,
		dismiss
	}: {
		toast: { tone: 'success' | 'error'; message: string } | null;
		dismiss: () => void;
	} = $props();
</script>

{#if toast}
	<div
		class="pointer-events-none fixed inset-x-0 top-5 z-50 flex justify-center px-5 sm:justify-end"
	>
		<div
			class="pointer-events-auto flex w-full max-w-md items-start gap-3 border bg-white px-4 py-3 shadow-lg"
			class:border-[#087ba8]={toast.tone === 'success'}
			class:border-red-700={toast.tone === 'error'}
			role={toast.tone === 'error' ? 'alert' : 'status'}
		>
			<span
				class="mt-1 h-2 w-2 shrink-0 rounded-full"
				class:bg-[#087ba8]={toast.tone === 'success'}
				class:bg-red-700={toast.tone === 'error'}
				aria-hidden="true"
			></span>
			<p class="flex-1 text-sm leading-6 font-semibold text-[#34404d]">{toast.message}</p>
			<button
				type="button"
				class="-mt-1 -mr-1 h-7 w-7 text-lg leading-none text-[#6a7684] hover:text-[#34404d]"
				onclick={dismiss}
				aria-label="알림 닫기">×</button
			>
		</div>
	</div>
{/if}
