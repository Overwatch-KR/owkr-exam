<script lang="ts">let {data}=$props();</script>

<main class="mx-auto flex min-h-screen max-w-6xl flex-col px-5 sm:px-8">
	<header class="flex h-20 items-center justify-between border-b border-ink">
		<a href="/" class="wordmark"><span class="wordmark-mark">O</span>OWKR EXAM</a>
		{#if data.user}
			<div class="flex items-center gap-4 text-sm"><span class="hidden text-stone-600 sm:inline">{data.user.displayName}</span><form method="POST" action="/auth/logout"><button class="text-xs font-bold text-stone-500 underline underline-offset-4 hover:text-ink">로그아웃</button></form></div>
		{/if}
	</header>

	<section class="grid flex-1 content-center gap-12 py-20 lg:grid-cols-[1.4fr_.6fr] lg:py-28">
		<div>
			<p class="eyebrow">OWKR ADMINISTRATION</p>
			<h1 class="mt-5 max-w-3xl text-4xl font-bold leading-[1.22] tracking-[-0.045em] sm:text-6xl">관리자 선발을 위한<br/>온라인 시험 시스템</h1>
			<p class="mt-7 max-w-xl text-base leading-7 text-stone-600">OWKR 내전 관리자를 위한 시험입니다. Discord 계정으로 본인을 확인하고, 운영진이 발급한 응시 코드로 시험을 진행하세요.</p>
			<div class="mt-9 flex flex-wrap gap-3">{#if !data.user}<a class="btn" href="/auth/login">Discord로 로그인</a>{:else}<a class="btn" href="/exam">시험 시작하기</a>{#if data.isAdmin}<a class="btn-secondary" href="/admin">시험 관리</a>{/if}{/if}</div>
		</div>
		<aside class="border-l-2 border-ink pl-5 pt-1"><p class="text-sm font-bold">응시 안내</p><dl class="mt-6 space-y-5 text-sm"><div><dt class="text-stone-500">01 · 로그인</dt><dd class="mt-1 font-semibold">Discord 계정으로 본인 확인</dd></div><div><dt class="text-stone-500">02 · 응시 코드</dt><dd class="mt-1 font-semibold">운영진이 발급한 1회용 코드 입력</dd></div><div><dt class="text-stone-500">03 · 시험 진행</dt><dd class="mt-1 font-semibold">60분 안에 답안을 저장·제출</dd></div></dl></aside>
	</section>

	<footer class="flex flex-col gap-2 border-t border-line py-6 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between"><span>© OWKR. 관리자 선발시험 운영용 서비스.</span><a href="/privacy" class="font-semibold text-stone-600 underline underline-offset-4 hover:text-ink">개인정보처리방침</a></footer>
</main>
