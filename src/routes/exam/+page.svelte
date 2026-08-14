<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
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
	let readyToStart = $state(false);
	let starting = $state(false);
	let attempt = $state<ExamSession | null>(null);
	let index = $state(0);
	let values = $state<Record<string, string>>({});
	let saveError = $state('');
	let remaining = $state(0);
	let confirm = $state(false);
	let submitting = $state(false);
	let q = $derived(attempt?.questions[index]);
	let answeredCount = $derived(
		attempt?.questions.filter((item) => values[item.id]?.trim()).length ?? 0
	);
	let allAnswered = $derived(
		Boolean(attempt?.questions.length) && answeredCount === attempt?.questions.length
	);
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
		let nextShortcutPressed = false;
		const onKeydown = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && confirm) confirm = false;
			if (!attempt || attempt.submittedAt || confirm) return;
			const isEnter = event.key === 'Enter' || event.code === 'NumpadEnter';
			if (isEnter && event.shiftKey) {
				event.preventDefault();
				if (event.isComposing || event.repeat || nextShortcutPressed) return;
				nextShortcutPressed = true;
				goNext();
				return;
			}
			const target = event.target as HTMLElement | null;
			const isTyping = Boolean(
				target?.closest('textarea, select, [contenteditable="true"], input:not([type="radio"])')
			);
			const choiceIndex = /^Numpad[1-5]$/.test(event.code)
				? Number(event.code.slice(-1)) - 1
				: /^[1-5]$/.test(event.key)
					? Number(event.key) - 1
					: null;
			if (!isTyping && !event.ctrlKey && !event.metaKey && !event.altKey && choiceIndex !== null) {
				event.preventDefault();
				selectChoice(choiceIndex);
			}
		};
		const onKeyup = (event: KeyboardEvent) => {
			if (event.key === 'Enter' || event.code === 'NumpadEnter') nextShortcutPressed = false;
		};
		const onBlur = () => {
			nextShortcutPressed = false;
		};
		addEventListener('pageshow', onShow);
		addEventListener('popstate', onPop);
		addEventListener('keydown', onKeydown);
		addEventListener('keyup', onKeyup);
		addEventListener('blur', onBlur);
		return () => {
			clearInterval(timer);
			clearPendingSaveTimers();
			removeEventListener('pageshow', onShow);
			removeEventListener('popstate', onPop);
			removeEventListener('keydown', onKeydown);
			removeEventListener('keyup', onKeyup);
			removeEventListener('blur', onBlur);
		};
	});
	const fmt = (ms: number) =>
		`${Math.floor(ms / 60000)}`.padStart(2, '0') +
		':' +
		`${Math.floor(ms / 1000) % 60}`.padStart(2, '0');

	function continueToInstructions() {
		message = '';
		const normalizedCode = code.trim().toUpperCase();
		if (!/^[A-Z0-9]{6}$/.test(normalizedCode)) {
			message = '영문과 숫자로 된 6자리 응시 코드를 입력해 주세요.';
			return;
		}
		code = normalizedCode;
		readyToStart = true;
	}

	async function start() {
		message = '';
		starting = true;
		try {
			const started = await startExam({ code: code.trim().toUpperCase() });
			attempt = started;
			values = Object.fromEntries(
				started.questions.map((question) => [question.id, question.answer])
			);
			remaining = new Date(started.expiresAt).getTime() - Date.now();
		} catch (error) {
			message = examErrorMessage(error, '올바른 6자리 코드를 입력해 주세요.');
		} finally {
			starting = false;
		}
	}

	let timers: Record<string, ReturnType<typeof setTimeout>> = {};
	let saveChains: Record<string, Promise<void>> = {};
	const dirtyAnswerIds = new Set<string>();
	const failedAnswerIds = new Set<string>();

	function save(id: string) {
		dirtyAnswerIds.add(id);
		clearTimeout(timers[id]);
		timers[id] = setTimeout(() => {
			delete timers[id];
			void persistAnswer(id).catch(() => undefined);
		}, 500);
	}

	async function persistAnswer(id: string) {
		const value = values[id] ?? '';
		const previous = saveChains[id] ?? Promise.resolve();
		const request = previous
			.catch(() => undefined)
			.then(() => saveAnswer({ attemptQuestionId: id, value }))
			.then(() => {
				failedAnswerIds.delete(id);
				if ((values[id] ?? '') === value) dirtyAnswerIds.delete(id);
				saveError = failedAnswerIds.size
					? '일부 답안을 저장하지 못했습니다. 네트워크를 확인해 주세요.'
					: '';
			})
			.catch((error) => {
				failedAnswerIds.add(id);
				saveError = '답안을 저장하지 못했습니다. 네트워크를 확인한 뒤 다시 입력해 주세요.';
				throw error;
			});
		saveChains[id] = request;
		try {
			await request;
		} finally {
			if (saveChains[id] === request) delete saveChains[id];
		}
	}

	async function flushPendingAnswers() {
		const answerIds = [...dirtyAnswerIds];
		for (const id of answerIds) {
			clearTimeout(timers[id]);
			delete timers[id];
		}
		await Promise.all(answerIds.map(persistAnswer));
	}

	function clearPendingSaveTimers() {
		for (const timer of Object.values(timers)) clearTimeout(timer);
		timers = {};
	}

	function goNext() {
		if (attempt && index < attempt.questions.length - 1) index += 1;
	}

	function selectChoice(optionIndex: number) {
		if (!q || q.type !== 'multiple' || optionIndex >= q.options.length) return;
		if (q.allowsMultipleAnswers) {
			const selected = selectedChoiceIndices(values[q.id]);
			const next = selected.includes(optionIndex)
				? selected.filter((item) => item !== optionIndex)
				: [...selected, optionIndex].sort((a, b) => a - b);
			values[q.id] = next.length ? JSON.stringify(next) : '';
		} else {
			values[q.id] = String(optionIndex);
		}
		save(q.id);
	}

	function selectedChoiceIndices(value: string | undefined) {
		if (!value?.trim()) return [];
		try {
			const parsed = JSON.parse(value);
			if (Array.isArray(parsed)) return parsed.filter(Number.isInteger);
		} catch {
			// 단일정답은 숫자 문자열로 저장됩니다.
		}
		const choice = Number(value);
		return Number.isInteger(choice) ? [choice] : [];
	}

	async function submit(timeout = false) {
		if (!attempt || submitting) return;
		submitting = true;
		try {
			if (timeout) clearPendingSaveTimers();
			else await flushPendingAnswers();
			const submitted = await submitExam({ attemptId: attempt.id, timeout });
			attempt = {
				...attempt,
				...submitted
			};
			confirm = false;
		} catch (error) {
			toast.error(
				saveError ||
					examErrorMessage(error, '시험을 제출하지 못했습니다. 잠시 후 다시 시도해 주세요.')
			);
		} finally {
			submitting = false;
		}
	}
</script>

{#if !attempt && !readyToStart}
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
				<form
					class="mt-8 border-y border-[#c8d0d9] py-6"
					aria-busy={starting}
					onsubmit={(event) => {
						event.preventDefault();
						continueToInstructions();
					}}
				>
					<label class="label" for="code">응시 코드</label><input
						id="code"
						bind:value={code}
						autocapitalize="characters"
						autocomplete="off"
						spellcheck="false"
						maxlength="6"
						required
						aria-describedby={message ? 'code-help code-error' : 'code-help'}
						aria-invalid={Boolean(message)}
						class="w-full text-center font-mono text-xl font-bold tracking-[0.42em] uppercase"
						placeholder="A7K3PX"
					/>
					<p id="code-help" class="mt-2 text-xs text-[#6a7684]">영문과 숫자 6자리</p>
					<button class="btn mt-4 w-full" disabled={starting}> 안내 확인 </button>
					{#if starting}<p class="mt-3 text-center text-xs text-[#6a7684]">
							시험 문제를 준비하고 있습니다.
						</p>{/if}
					{#if message}<p id="code-error" role="alert" class="notice-error mt-3">
							{message}
						</p>{/if}
				</form>
			</div>
		</section>
	</main>
{:else if !attempt}
	<main class="min-h-screen bg-[#f7f8fa]">
		<header class="site-header">
			<div class="mx-auto flex h-16 max-w-2xl items-center justify-between px-5">
				<a href="/" class="wordmark">OWKR EXAM</a>
				<button
					type="button"
					class="text-xs font-semibold text-[#087ba8] underline underline-offset-4"
					onclick={() => {
						readyToStart = false;
						message = '';
					}}>코드 다시 입력</button
				>
			</div>
		</header>
		<section class="mx-auto max-w-2xl px-5 py-12 sm:py-16">
			<p class="eyebrow">EXAM GUIDE</p>
			<h1 class="mt-3 text-[28px] font-bold tracking-[-.04em]">시험 안내</h1>
			<p class="mt-3 text-sm leading-6 text-[#6a7684]">
				안내를 확인한 뒤 시험을 시작해 주세요. <b class="font-semibold text-[#34404d]"
					>시험 시작을 누르는 순간부터 60분이 적용됩니다.</b
				>
			</p>

			<div class="mt-8 space-y-4 border-y border-[#c8d0d9] py-6 text-sm leading-7 text-[#34404d]">
				<p>
					※ 객관식 (19) 문항, 단답형 (9) 문항, 서술형 (6) 문항, 논술형 (1) 문항, 총 ({data.activeQuestionCount})
					문항으로 구성되어 있습니다.
				</p>
				<p>※ 객관식 44점, 단답형 16점, 서술형 20점, 논술형 20점, 총 100점 만점입니다.</p>
				<p>
					※ 응시 시간은 60분이며, 답안 제출 전 문제의 정답을 제대로 체크 또는 작성하였는지 다시 한
					번 검토하시길 바랍니다.
				</p>
				<p>
					※ 본 시험지의 저작권은 오버워치 코리아 서버에 있습니다. 유출 또는 누설하는 행위 일체를
					금합니다.
				</p>
			</div>

			{#if message}<p role="alert" class="notice-error mt-5">{message}</p>{/if}
			<div class="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
				<button
					type="button"
					class="btn-secondary"
					disabled={starting}
					onclick={() => (readyToStart = false)}>이전</button
				>
				<button type="button" class="btn" disabled={starting} onclick={start}>
					{starting ? '시험 준비 중…' : '시험 시작'}
				</button>
			</div>
			{#if starting}<p class="mt-3 text-right text-xs text-[#6a7684]">
					시험 문제를 준비하고 있습니다.
				</p>{/if}
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
				<p class="mt-8 text-sm font-semibold text-[#34404d]">이 페이지를 종료해도 됩니다.</p>
			</div>
		</section>
	</main>
{:else}
	<main class="min-h-screen bg-[#f3f5f7]">
		<header class="site-header">
			<div class="mx-auto flex h-16 max-w-[1320px] items-center justify-between px-5 sm:px-8">
				<span class="wordmark">OWKR EXAM</span>
				<div class="text-right">
					<p class="text-[10px] font-semibold tracking-[0.12em] text-[#6a7684]">남은 시간</p>
					<p class="font-mono text-xl font-bold text-[#087ba8] tabular-nums">{fmt(remaining)}</p>
				</div>
			</div>
		</header>
		<div class="mx-auto max-w-[1320px] px-5 py-6 sm:px-8 sm:py-8">
			<div class="mb-5 flex items-end justify-between border-b-2 border-[#34404d] pb-4">
				<div>
					<p class="text-base font-bold tracking-[-.02em]">OWKR 관리자 선발시험</p>
					<p class="mt-1 text-xs text-[#6a7684]">
						문제 {index + 1} / {attempt.questions.length} · 답변 {answeredCount}개
					</p>
				</div>
				{#if saveError}<p role="alert" class="notice-error max-w-sm text-xs">
						{saveError}
					</p>{/if}
			</div>
			<div class="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
				<aside class="h-fit border border-[#bfd4df] bg-[#eaf7fb] p-4 lg:sticky lg:top-5">
					<div class="mb-4 flex items-baseline justify-between">
						<p class="text-sm font-bold text-[#24333f]">문항 목록</p>
						<span class="font-mono text-xs font-bold text-[#087ba8]"
							>{answeredCount}/{attempt.questions.length}</span
						>
					</div>
					<div class="grid grid-cols-6 gap-1.5 lg:grid-cols-5">
						{#each attempt.questions as item, i}
							<button
								type="button"
								aria-label={`${i + 1}번 문제${values[item.id]?.trim() ? ', 답변 있음' : ', 미응답'}`}
								aria-current={i === index ? 'step' : undefined}
								onclick={() => (index = i)}
								class="h-9 border text-xs font-semibold transition-colors {i === index
									? 'border-[#087ba8] bg-[#087ba8] text-white'
									: values[item.id]?.trim()
										? 'border-[#b7dce9] bg-[#effbff] text-[#087ba8]'
										: 'border-line bg-white'}">{i + 1}</button
							>
						{/each}
					</div>
					<p class="mt-4 border-t border-[#bfd4df] pt-3 text-[11px] leading-5 text-[#52616e]">
						연한 파랑: 답변 완료<br />진한 파랑: 현재 문제
					</p>
					<p class="mt-3 text-[11px] leading-5 text-[#52616e]">
						Shift + Enter: 다음 문제<br />1–5: 객관식 선택{q?.allowsMultipleAnswers ? '/해제' : ''}
					</p>
					{#if allAnswered}
						<p id="all-answered" class="mt-4 text-center text-xs font-semibold text-[#087ba8]">
							모든 문항에 답했습니다.
						</p>
					{/if}
					<button
						type="button"
						class={allAnswered
							? 'btn mt-3 w-full ring-2 ring-[#087ba8]/20 ring-offset-2'
							: 'btn mt-5 w-full'}
						aria-describedby={allAnswered ? 'all-answered' : undefined}
						disabled={submitting}
						onclick={() => (confirm = true)}>시험 제출</button
					>
				</aside>
				{#if q}
					{#key q.id}
						<section
							class="border border-[#d5dce2] bg-white p-6 shadow-[0_1px_1px_rgba(17,24,32,0.02)] sm:p-9"
						>
							<div class="border-b-2 border-[#34404d] pb-6">
								<div class="flex items-baseline justify-between">
									<p class="font-mono text-sm font-bold text-[#087ba8]">문제 {index + 1}</p>
									<span class="text-sm font-semibold text-[#52616e]">배점 {q.points}점</span>
								</div>
								<h1
									class="mt-6 text-xl leading-9 font-medium tracking-[-.02em] whitespace-pre-wrap sm:text-[22px]"
								>
									{q.content}
								</h1>
							</div>
							{#if q.type === 'multiple'}
								<div class="mt-8 border border-[#cfd8df]">
									{#each q.options as option, i}<label
											class="flex cursor-pointer gap-4 border-b border-[#dfe4e9] bg-white px-5 py-4 last:border-0 hover:bg-[#f5fbfd]"
											>{#if q.allowsMultipleAnswers}
												<input
													type="checkbox"
													name={q.id}
													value={String(i)}
													checked={selectedChoiceIndices(values[q.id]).includes(i)}
													onchange={() => selectChoice(i)}
													class="mt-0.5"
												/>
											{:else}
												<input
													type="radio"
													name={q.id}
													value={String(i)}
													bind:group={values[q.id]}
													onchange={() => save(q.id)}
													class="mt-0.5"
												/>
											{/if}<span class="text-sm leading-6"
												><b class="mr-2 text-[#087ba8]">{i + 1}.</b>{option}</span
											></label
										>{/each}
								</div>
								{#if q.allowsMultipleAnswers}
									<p class="mt-3 text-xs text-[#6a7684]">
										복수 선택 문제입니다. 해당하는 보기를 모두 선택하세요.
									</p>
								{/if}
							{:else}<textarea
									aria-label={`${index + 1}번 문제 답안`}
									class="mt-8 min-h-52 w-full leading-7"
									bind:value={values[q.id]}
									oninput={() => save(q.id)}
									placeholder={q.type === 'short'
										? '답변을 입력하세요.'
										: '답변을 충분히 작성하세요.'}></textarea>{/if}
							<div class="mt-8 flex justify-between border-t-2 border-[#34404d] pt-5">
								<button
									type="button"
									class="btn-secondary"
									disabled={index === 0}
									onclick={() => index--}>← 이전 문제</button
								>
								<button
									type="button"
									class="btn-secondary"
									disabled={index === attempt.questions.length - 1}
									onclick={goNext}
									>다음 문제 →
								</button>
							</div>
						</section>
					{/key}
				{/if}
			</div>
		</div>
	</main>
	<AlertDialog.Root bind:open={confirm}>
		<AlertDialog.Content
			class="max-w-md overflow-hidden rounded-lg bg-white p-0 shadow-[0_24px_64px_rgba(17,24,32,0.28)]"
		>
			<div class="border-b border-[#dfe4e9] px-6 py-4">
				<p class="text-sm font-semibold">답안 제출 확인</p>
			</div>
			<div class="p-6">
				<AlertDialog.Title class="text-xl font-bold">시험을 제출할까요?</AlertDialog.Title>
				<AlertDialog.Description class="mt-4 text-sm leading-6 text-[#6a7684]">
					제출 후에는 답안을 수정하거나 다시 응시할 수 없습니다.<br />미응답 문항:
					<b>{attempt.questions.filter((item) => !values[item.id]?.trim()).length}개</b>
				</AlertDialog.Description>
				<div class="mt-7 flex justify-end gap-2">
					<AlertDialog.Cancel class="btn-secondary">계속 작성</AlertDialog.Cancel>
					<button type="button" class="btn" disabled={submitting} onclick={() => submit()}>
						{submitting ? '답안 저장 중…' : '제출하기'}
					</button>
				</div>
			</div>
		</AlertDialog.Content>
	</AlertDialog.Root>
{/if}
