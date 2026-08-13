<script lang="ts">
	import { onMount } from 'svelte';
	import {
		examErrorMessage,
		saveAnswer,
		startExam,
		submitExam,
		type ExamAttempt
	} from '$lib/domains/exam/client/public';

	type ExamSession = ExamAttempt & {
		submittedAt?: string;
		objectiveScore?: number;
		objectiveMaxScore?: number;
	};

	let { data } = $props();
	let code = $state('');
	let message = $state('');
	let attempt = $state<ExamSession | null>(null);
	let index = $state(0);
	let values = $state<Record<string, string>>({});
	let saving = $state('');
	let remaining = $state(0);
	let confirm = $state(false);
	let q = $derived(attempt?.questions[index]);
	onMount(() => {
		const timer = setInterval(() => {
			if (attempt) {
				remaining = Math.max(0, new Date(attempt.expiresAt).getTime() - Date.now());
				if (!remaining) submit(true);
			}
		}, 1000);
		const onShow = (e: PageTransitionEvent) => {
			if (e.persisted) location.replace('/exam');
		};
		const onPop = () => location.replace('/exam');
		addEventListener('pageshow', onShow);
		addEventListener('popstate', onPop);
		return () => {
			clearInterval(timer);
			removeEventListener('pageshow', onShow);
			removeEventListener('popstate', onPop);
		};
	});
	const fmt = (ms: number) =>
		`${Math.floor(ms / 60000)}`.padStart(2, '0') +
		':' +
		`${Math.floor(ms / 1000) % 60}`.padStart(2, '0');

	async function start() {
		message = '';
		try {
			const started = await startExam({ code });
			attempt = started;
			values = Object.fromEntries(
				started.questions.map((question) => [question.id, question.answer])
			);
			remaining = new Date(started.expiresAt).getTime() - Date.now();
		} catch (error) {
			message = examErrorMessage(error, '올바른 6자리 코드를 입력해 주세요.');
		}
	}

	let timers: Record<string, ReturnType<typeof setTimeout>> = {};

	function save(id: string) {
		clearTimeout(timers[id]);
		timers[id] = setTimeout(async () => {
			saving = '저장 중';
			try {
				await saveAnswer({ attemptQuestionId: id, value: values[id] ?? '' });
				saving = '저장됨';
			} catch {
				saving = '저장 실패';
			}
		}, 500);
	}

	async function submit(timeout = false) {
		if (!attempt) return;
		try {
			const submitted = await submitExam({ attemptId: attempt.id, timeout });
			attempt = {
				...attempt,
				...submitted
			};
			confirm = false;
		} catch (error) {
			message = examErrorMessage(error, '시험을 제출하지 못했습니다.');
		}
	}
</script>

{#if !attempt}
	<main class="min-h-screen bg-[#f7f8fa]">
		<header class="site-header">
			<div class="mx-auto flex h-16 max-w-xl items-center justify-between px-5">
				<a href="/" class="wordmark">OWKR EXAM</a>
				{#if data.isAdmin}<a
						href="/admin"
						class="text-xs font-semibold text-[#087ba8] underline underline-offset-4">시험 관리</a
					>{/if}
			</div>
		</header>
		<section class="mx-auto flex min-h-[calc(100vh-64px)] max-w-xl items-center px-5 py-12">
			<div class="w-full">
				<p class="eyebrow">EXAM ENTRY</p>
				<h1 class="mt-3 text-[28px] font-bold tracking-[-.04em]">응시 코드 입력</h1>
				<p class="mt-3 text-sm leading-6 text-[#6a7684]">
					운영진에게 받은 6자리 코드를 입력하세요.<br />시험 시작 후 제한시간 60분이 적용됩니다.
				</p>
				<div class="mt-8 border-y border-[#c8d0d9] py-6">
					<label class="label" for="code">응시 코드</label><input
						id="code"
						bind:value={code}
						maxlength="6"
						class="w-full text-center font-mono text-xl font-bold tracking-[0.42em] uppercase"
						placeholder="A7K3PX"
					/>
					<button class="btn mt-4 w-full" onclick={start}>시험 시작</button>
					{#if message}<p class="mt-3 text-sm font-semibold text-red-700">{message}</p>{/if}
				</div>
			</div>
		</section>
	</main>
{:else if attempt.submittedAt}
	<main class="min-h-screen bg-[#f7f8fa]">
		<header class="site-header">
			<div class="mx-auto flex h-16 max-w-xl items-center px-5">
				<a href="/" class="wordmark">OWKR EXAM</a>
			</div>
		</header>
		<section class="mx-auto flex min-h-[calc(100vh-64px)] max-w-xl items-center px-5 py-12">
			<div class="w-full">
				<p class="eyebrow">SUBMISSION COMPLETE</p>
				<h1 class="mt-3 text-[28px] font-bold tracking-[-.04em]">답안이 제출되었습니다.</h1>
				<div class="mt-7 border-y border-[#c8d0d9] py-6">
					<p class="text-xs font-semibold tracking-widest text-[#6a7684]">객관식 점수</p>
					<p class="mt-2 font-mono text-4xl font-bold tracking-[-.04em] text-[#087ba8]">
						{attempt.objectiveScore}
						<span class="ml-2 text-xl text-[#6a7684]">/ {attempt.objectiveMaxScore}</span>
					</p>
				</div>
				<p class="mt-5 text-sm leading-6 text-[#6a7684]">
					객관식 점수만 즉시 공개됩니다. 단답·서술·논술형 점수와 총점은 운영진만 확인하며, 제출
					이후에는 답안을 변경할 수 없습니다.
				</p>
				<a href="/" class="btn mt-8">메인으로 돌아가기</a>
			</div>
		</section>
	</main>
{:else}
	<main class="min-h-screen bg-[#f7f8fa]">
		<header class="site-header">
			<div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
				<span class="wordmark">OWKR EXAM</span>
				<div class="text-right">
					<p class="text-[10px] font-semibold tracking-widest text-[#6a7684]">남은 시간</p>
					<p class="font-mono text-lg font-bold text-[#087ba8] tabular-nums">{fmt(remaining)}</p>
				</div>
			</div>
		</header>
		<div class="mx-auto max-w-6xl px-5 py-7">
			<div class="mb-4 flex items-end justify-between border-b border-[#c8d0d9] pb-4">
				<div>
					<p class="text-sm font-semibold">OWKR 관리자 선발시험</p>
					<p class="mt-1 text-xs text-[#6a7684]">문제 {index + 1} / {attempt.questions.length}</p>
				</div>
				<span class="text-xs text-[#6a7684]">{saving || '답안은 자동 저장됩니다.'}</span>
			</div>
			<div class="grid gap-4 lg:grid-cols-[190px_minmax(0,1fr)]">
				<aside class="card h-fit p-4">
					<p class="mb-3 text-xs font-semibold text-[#34404d]">문항 목록</p>
					<div class="grid grid-cols-5 gap-1.5">
						{#each attempt.questions as item, i}
							<button
								aria-label={`${i + 1}번 문제`}
								onclick={() => (index = i)}
								class="h-9 rounded-md border text-xs font-semibold {i === index
									? 'border-[#087ba8] bg-[#087ba8] text-white'
									: values[item.id]?.trim()
										? 'border-[#b7dce9] bg-[#effbff] text-[#087ba8]'
										: 'border-line bg-white'}">{i + 1}</button
							>
						{/each}
					</div>
					<p class="mt-3 text-[11px] leading-5 text-[#6a7684]">
						연한 파랑: 답변 저장됨<br />진한 파랑: 현재 문제
					</p>
					<button class="btn mt-6 w-full" onclick={() => (confirm = true)}>시험 제출</button>
				</aside>
				{#if q}
					<section class="card p-6 sm:p-8">
						<div class="border-b border-[#dfe4e9] pb-5">
							<div class="flex items-baseline justify-between">
								<p class="text-sm font-semibold text-[#087ba8]">문제 {index + 1}</p>
								<span class="text-sm text-[#6a7684]">배점 {q.points}점</span>
							</div>
							<h1 class="mt-5 text-xl leading-9 font-medium tracking-[-.02em] whitespace-pre-wrap">
								{q.content}
							</h1>
						</div>
						{#if q.type === 'multiple'}
							<div class="mt-8 border border-[#dfe4e9]">
								{#each q.options as option, i}<label
										class="flex cursor-pointer gap-4 border-b border-[#dfe4e9] bg-white px-4 py-4 last:border-0 hover:bg-[#f5fbfd]"
										><input
											type="radio"
											name={q.id}
											value={String(i)}
											bind:group={values[q.id]}
											onchange={() => save(q.id)}
											class="mt-0.5"
										/><span class="text-sm leading-6"
											><b class="mr-2 text-[#087ba8]">{i + 1}.</b>{option}</span
										></label
									>{/each}
							</div>
						{:else}<textarea
								class="mt-8 min-h-52 w-full leading-7"
								bind:value={values[q.id]}
								oninput={() => save(q.id)}
								placeholder={q.type === 'short'
									? '답변을 입력하세요.'
									: '답변을 충분히 작성하세요.'}></textarea>{/if}
						<div class="mt-8 flex justify-between border-t border-[#dfe4e9] pt-5">
							<button class="btn-secondary" disabled={index === 0} onclick={() => index--}
								>← 이전 문제</button
							>
							<button
								class="btn-secondary"
								disabled={index === attempt.questions.length - 1}
								onclick={() => index++}
								>다음 문제 →
							</button>
						</div>
					</section>
				{/if}
			</div>
		</div>
	</main>
	{#if confirm}
		<div class="fixed inset-0 grid place-items-center bg-black/45 p-5">
			<section class="w-full max-w-md rounded-md bg-white shadow-xl">
				<div class="border-b border-[#dfe4e9] px-6 py-4">
					<p class="text-sm font-semibold">답안 제출 확인</p>
				</div>
				<div class="p-6">
					<h2 class="text-xl font-bold">시험을 제출할까요?</h2>
					<p class="mt-4 text-sm leading-6 text-[#6a7684]">
						제출 후에는 답안을 수정하거나 다시 응시할 수 없습니다.<br />미응답 문항:
						<b>{attempt.questions.filter((item) => !values[item.id]?.trim()).length}개</b>
					</p>
					<div class="mt-7 flex justify-end gap-2">
						<button class="btn-secondary" onclick={() => (confirm = false)}>계속 작성</button>
						<button class="btn" onclick={() => submit()}>제출하기</button>
					</div>
				</div>
			</section>
		</div>
	{/if}
{/if}
