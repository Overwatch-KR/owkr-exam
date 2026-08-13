<script lang="ts">
		import {page} from '$app/state';

		const content = $derived.by(() => {
				switch (page.status) {
						case 401:
								return {
										title: '로그인이 필요합니다',
										description: '시험 또는 관리 화면을 이용하려면 먼저 로그인해 주세요.',
										action: '로그인하기',
										behavior: 'link',
										href: '/auth/login'
								};
						case 403:
								return {
										title: '접근 권한이 없습니다',
										description: '현재 계정으로는 이 화면을 열 수 없습니다.',
										action: '이전 페이지로',
										behavior: 'back',
										href: null
								};
						case 404:
								return {
										title: '페이지를 찾을 수 없습니다',
										description: '주소가 잘못되었거나 페이지가 이동되었을 수 있습니다.',
										action: '이전 페이지로',
										behavior: 'back',
										href: null
								};
						default:
								return {
										title: '화면을 불러오지 못했습니다',
										description: '일시적인 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
										action: '다시 시도하기',
										behavior: 'reload',
										href: null
								};
				}
		});

		function goBack() {
				if (history.length > 1) history.back();
				else location.href = '/';
		}
</script>

<svelte:head><title>{page.status} · OWKR Exam</title></svelte:head>

<main class="min-h-screen bg-paper">
    <header class="site-header">
        <div class="mx-auto flex h-16 max-w-5xl items-center px-5">
            <a href="/" class="wordmark"><span class="wordmark-mark">O</span>OWKR EXAM</a>
        </div>
    </header>

    <section class="mx-auto flex min-h-[calc(100vh-64px)] max-w-5xl items-center px-5 py-16">
        <div class="w-full max-w-xl">
            <div class="mb-7 flex h-12 w-12 items-center justify-center rounded-full bg-sky text-navy"
                 aria-hidden="true">
                <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path d="M12 8v4.5" stroke-linecap="round"/>
                    <path d="M12 16.25h.01" stroke-linecap="round"/>
                    <circle cx="12" cy="12" r="9"/>
                </svg>
            </div>
            <p class="font-mono text-xs font-bold tracking-[0.12em] text-navy">ERROR {page.status}</p>
            <h1 class="mt-3 text-[32px] font-bold tracking-[-0.045em] text-ink sm:text-[40px]">{content.title}</h1>
            <p class="mt-4 max-w-md text-sm leading-6 text-muted sm:text-base">{content.description}</p>

            <div class="mt-9 flex flex-wrap gap-3 border-t border-line pt-6">
                {#if content.behavior === 'link' && content.href}
                    <a href={content.href} class="btn">{content.action}</a>
				{:else if content.behavior === 'back'}
					<button class="btn" onclick={goBack}>{content.action}</button>
                {:else}
                    <button class="btn" onclick={() => location.reload()}>{content.action}</button>
                {/if}
                <a href="/" class="btn-secondary">홈으로</a>
            </div>
        </div>
    </section>
</main>
