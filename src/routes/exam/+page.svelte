<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { toast } from 'svelte-sonner';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import {
		examErrorMessage,
		getExamStatus,
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
	let pendingAnswerCount = $state(0);
	let retryingSave = $state(false);
	let remaining = $state(0);
	let confirm = $state(false);
	let submitting = $state(false);
	let statusSyncing = $state(false);
	let serverTimeOffset = $state(0);
	let q = $derived(attempt?.questions[index]);
	let reviewIds = $state<string[]>([]);
	let questionFilter = $state<'all' | 'unanswered' | 'review'>('all');
	let numberedQuestions = $derived(attempt?.questions.map((item, i) => ({ item, i })) ?? []);
	let unansweredQuestions = $derived(
		numberedQuestions.filter(({ item }) => !values[item.id]?.trim())
	);
	let reviewQuestions = $derived(
		numberedQuestions.filter(({ item }) => reviewIds.includes(item.id))
	);
	let visibleQuestions = $derived(
		questionFilter === 'unanswered'
			? unansweredQuestions
			: questionFilter === 'review'
				? reviewQuestions
				: numberedQuestions
	);
	let longEssay = $derived(q?.type === 'essay' && index === (attempt?.questions.length ?? 0) - 1);
	async function goToQuestion(nextIndex: number) {
		if (!attempt || answerLocked || nextIndex < 0 || nextIndex >= attempt.questions.length) return;
		confirm = false;
		index = nextIndex;
		await tick();
		const heading = document.getElementById('exam-question-heading');
		heading?.focus({ preventScroll: true });
		heading?.scrollIntoView({ block: 'start' });
	}
	function toggleReview() {
		if (!q || answerLocked) return;
		reviewIds = reviewIds.includes(q.id)
			? reviewIds.filter((id) => id !== q.id)
			: [...reviewIds, q.id];
	}
	let answeredCount = $derived(
		attempt?.questions.filter((item) => values[item.id]?.trim()).length ?? 0
	);
	let allAnswered = $derived(
		Boolean(attempt?.questions.length) && answeredCount === attempt?.questions.length
	);
	let answerLocked = $derived(Boolean(attempt?.pausedAt) || submitting);
	let questionCount = $derived(data.examSummary.reduce((sum, item) => sum + item.count, 0));
	let totalPoints = $derived(data.examSummary.reduce((sum, item) => sum + item.points, 0));
	onMount(() => {
		const timer = setInterval(() => {
			if (attempt && !attempt.submittedAt) {
				updateRemaining();
				if (!attempt.pausedAt && !remaining) submit(true);
			}
		}, 1000);
		const statusTimer = setInterval(() => void syncStatus(), 3000);
		const onShow = (e: PageTransitionEvent) => {
			if (e.persisted) location.replace('/exam');
		};
		const onPop = () => location.replace('/exam');
		let nextShortcutPressed = false;
		const onKeydown = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && confirm) confirm = false;
			if (!attempt || attempt.submittedAt || answerLocked || confirm) return;
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
		const onBeforeUnload = (event: BeforeUnloadEvent) => {
			if (!attempt || attempt.submittedAt || !dirtyAnswerIds.size) return;
			event.preventDefault();
			event.returnValue = '';
		};
		const onOnline = () => void retryAnswers();
		addEventListener('pageshow', onShow);
		addEventListener('popstate', onPop);
		addEventListener('keydown', onKeydown);
		addEventListener('keyup', onKeyup);
		addEventListener('blur', onBlur);
		addEventListener('beforeunload', onBeforeUnload);
		addEventListener('online', onOnline);
		return () => {
			clearInterval(timer);
			clearInterval(statusTimer);
			clearPendingSaveTimers();
			removeEventListener('pageshow', onShow);
			removeEventListener('popstate', onPop);
			removeEventListener('keydown', onKeydown);
			removeEventListener('keyup', onKeyup);
			removeEventListener('blur', onBlur);
			removeEventListener('beforeunload', onBeforeUnload);
			removeEventListener('online', onOnline);
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
			serverTimeOffset = new Date(started.serverNow).getTime() - Date.now();
			updateRemaining();
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
		if (answerLocked || attempt?.submittedAt) return;
		dirtyAnswerIds.add(id);
		pendingAnswerCount = dirtyAnswerIds.size;
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
				pendingAnswerCount = dirtyAnswerIds.size;
				saveError = failedAnswerIds.size
					? '일부 답안을 저장하지 못했습니다. 네트워크를 확인해 주세요.'
					: '';
			})
			.catch((error) => {
				failedAnswerIds.add(id);
				saveError = '답안을 저장하지 못했습니다. 네트워크를 확인한 뒤 저장을 다시 시도해 주세요.';
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
		const results = await Promise.allSettled(answerIds.map(persistAnswer));
		const failed = results.find((result) => result.status === 'rejected');
		if (failed?.status === 'rejected') throw failed.reason;
	}

	async function retryAnswers() {
		if (!attempt || attempt.submittedAt || answerLocked || retryingSave) return;
		retryingSave = true;
		try {
			await flushPendingAnswers();
		} catch {
			// 저장 실패 안내를 유지하고 다음 재시도를 허용합니다.
		} finally {
			retryingSave = false;
		}
	}

	function clearPendingSaveTimers() {
		for (const timer of Object.values(timers)) clearTimeout(timer);
		timers = {};
	}

	function goNext() {
		void goToQuestion(index + 1);
	}

	function selectChoice(optionIndex: number) {
		if (!q || answerLocked || q.type !== 'multiple' || optionIndex >= q.options.length) return;
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
		if (!attempt || attempt.submittedAt || submitting) return;
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
			if (timeout) {
				await syncStatus();
				if (attempt?.submittedAt || attempt?.pausedAt || remaining > 0) return;
			}
			toast.error(
				saveError ||
					examErrorMessage(error, '시험을 제출하지 못했습니다. 잠시 후 다시 시도해 주세요.')
			);
		} finally {
			submitting = false;
		}
	}

	function updateRemaining() {
		if (!attempt) return;
		const reference = attempt.pausedAt
			? new Date(attempt.pausedAt).getTime()
			: Date.now() + serverTimeOffset;
		remaining = Math.max(0, new Date(attempt.expiresAt).getTime() - reference);
	}

	async function syncStatus() {
		if (!attempt || attempt.submittedAt || statusSyncing) return;
		statusSyncing = true;
		try {
			const wasPaused = Boolean(attempt.pausedAt);
			const status = await getExamStatus({ attemptId: attempt.id });
			serverTimeOffset = new Date(status.serverNow).getTime() - Date.now();
			attempt = {
				...attempt,
				expiresAt: status.expiresAt,
				pausedAt: status.pausedAt
			};
			updateRemaining();
			if (!wasPaused && status.pausedAt) clearPendingSaveTimers();
			if (wasPaused && !status.pausedAt && dirtyAnswerIds.size) {
				void flushPendingAnswers().catch(() => undefined);
			}
			if (status.submittedAt) {
				const submitted = await submitExam({ attemptId: attempt.id, timeout: status.timedOut });
				attempt = { ...attempt, ...submitted };
				confirm = false;
			}
		} catch {
			// 일시적인 상태 확인 실패는 다음 주기에서 다시 시도합니다.
		} finally {
			statusSyncing = false;
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
					※ {data.examSummary
						.filter((item) => item.count > 0)
						.map((item) => `${item.label} ${item.count}문제`)
						.join(', ')} · 총 {questionCount}문제입니다.
				</p>
				<p>
					※ {data.examSummary
						.filter((item) => item.count > 0)
						.map((item) => `${item.label} ${item.points}점`)
						.join(', ')}, 총 {totalPoints}점 만점입니다.
				</p>
				<p>
					※ 답안은 자동으로 저장됩니다. 저장하지 못했다는 안내가 나오면 ‘답안 다시 저장’을 눌러
					주세요. 서술·논술형의 권장 분량은 참고용이며 분량 자체는 채점하지 않습니다.
				</p>
				<p>※ 시험 시간은 60분입니다. 제출하기 전에 답을 빠뜨린 문제가 없는지 확인해 주세요.</p>
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
				<button
					type="button"
					class="btn"
					disabled={starting || questionCount === 0}
					onclick={start}
				>
					{starting ? '시험 준비 중…' : '시험 시작'}
				</button>
			</div>
			{#if questionCount === 0}<p role="alert" class="notice-error mt-3">
					등록된 시험 문제가 없습니다. 운영진에게 문의해 주세요.
				</p>{/if}
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
		<header class="site-header sticky top-0 z-30 bg-white shadow-sm">
			<div
				class="mx-auto flex min-h-20 max-w-[1200px] items-center justify-between gap-3 px-5 py-3 sm:px-8"
			>
				<span class="wordmark">OWKR EXAM</span>
				<div class="text-right">
					<p class="text-[10px] font-semibold tracking-[0.12em] text-[#6a7684]">
						{attempt.pausedAt ? '시험 일시 중지' : '남은 시간'}
					</p>
					<p class="font-mono text-xl font-bold text-[#087ba8] tabular-nums">
						{attempt.pausedAt ? '중지됨' : fmt(remaining)}
					</p>
					<p role="status" class="text-xs text-[#6a7684]">
						{saveError
							? '저장하지 못했습니다'
							: pendingAnswerCount
								? '답안을 저장하는 중…'
								: '답안이 저장되었습니다'}
					</p>
				</div>
			</div>
		</header>
		<div class="mx-auto max-w-[1200px] px-5 py-6 sm:px-8 sm:py-8">
			<div class="mb-5 flex items-end justify-between border-b-2 border-[#34404d] pb-4">
				<div>
					<p class="text-base font-bold tracking-[-.02em]">OWKR 관리자 선발시험</p>
					<p class="mt-1 text-xs text-[#6a7684]">
						문제 {index + 1} / {attempt.questions.length} · 답변 {answeredCount}개
					</p>
				</div>
				<div class="max-w-sm text-right">
					{#if saveError}
						<p role="alert" class="notice-error mt-2 text-left text-xs">{saveError}</p>
						<button
							type="button"
							class="btn-secondary mt-2"
							disabled={answerLocked || retryingSave}
							onclick={retryAnswers}>{retryingSave ? '다시 저장하는 중…' : '답안 다시 저장'}</button
						>
					{/if}
				</div>
			</div>
			{#if attempt.pausedAt}
				<div
					role="status"
					aria-live="polite"
					class="mb-5 border border-[#b8d8e5] bg-[#effbff] px-4 py-3 text-sm text-[#34404d]"
				>
					<p class="font-bold text-[#087ba8]">관리자가 시험 시간을 일시 중지했습니다.</p>
					<p class="mt-1 text-xs leading-5">
						남은 시간은 줄어들지 않으며, 재개될 때까지 답안을 수정할 수 없습니다.
					</p>
				</div>
			{/if}
			<div class="grid gap-5 md:grid-cols-[184px_minmax(0,1fr)]">
				<aside
					class="order-2 h-fit border border-[#d5dce2] bg-white p-3 md:sticky md:top-24 md:order-1 md:max-h-[calc(100dvh-7rem)] md:overflow-y-auto"
				>
					<div class="mb-4 flex items-baseline justify-between">
						<p class="text-sm font-bold text-[#24333f]">문제 번호</p>
						<span class="font-mono text-xs font-bold text-[#087ba8]"
							>{answeredCount}/{attempt.questions.length}</span
						>
					</div>
					<div class="mb-3 grid gap-1.5" aria-label="문제 모아 보기">
						{#each [{ value: 'all', label: '전체', count: numberedQuestions.length }, { value: 'unanswered', label: '안 푼 문제', count: unansweredQuestions.length }, { value: 'review', label: '다시 볼 문제', count: reviewQuestions.length }] as filter}
							<button
								type="button"
								class="btn-secondary w-full justify-between px-2 py-1 text-xs aria-pressed:border-[#087ba8] aria-pressed:bg-[#d8edf5] aria-pressed:text-[#075c7d]"
								aria-pressed={questionFilter === filter.value}
								onclick={() => (questionFilter = filter.value as typeof questionFilter)}
								>{filter.label} {filter.count}</button
							>
						{/each}
					</div>
					<div class="grid grid-cols-7 gap-1 md:grid-cols-5">
						{#each visibleQuestions as { item, i }}
							<button
								type="button"
								aria-label={`${i + 1}번 문제${values[item.id]?.trim() ? ', 답변 있음' : ', 아직 답하지 않음'}${reviewIds.includes(item.id) ? ', 나중에 다시 보기' : ''}`}
								aria-current={i === index ? 'step' : undefined}
								disabled={answerLocked}
								onclick={() => goToQuestion(i)}
								class="relative h-8 min-w-0 border text-xs font-semibold transition-colors {i ===
								index
									? 'border-[#087ba8] bg-[#087ba8] text-white'
									: values[item.id]?.trim()
										? 'border-[#b7dce9] bg-[#effbff] text-[#087ba8]'
										: 'border-line bg-white'}"
							>
								<span>{i + 1}</span>
								{#if reviewIds.includes(item.id)}<span
										aria-hidden="true"
										class="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-[#b45309] ring-1 ring-white"
									></span>{/if}
							</button>
						{/each}
					</div>
					{#if !visibleQuestions.length}<p role="status" class="text-xs leading-5">
							{questionFilter === 'review'
								? '나중에 다시 볼 문제가 없습니다.'
								: '모든 문제에 답했습니다.'}
						</p>{/if}
					<p class="mt-4 border-t border-[#bfd4df] pt-3 text-[11px] leading-5 text-[#52616e]">
						연한 파랑: 답한 문제<br />진한 파랑: 지금 보는 문제<br />주황색 점: 다시 볼 문제
					</p>
					<p class="mt-3 text-[11px] leading-5 text-[#52616e]">
						Shift + Enter: 다음 문제<br />1–5: 객관식 선택{q?.allowsMultipleAnswers ? '/해제' : ''}
					</p>
					{#if allAnswered}
						<p id="all-answered" class="mt-4 text-center text-xs font-semibold text-[#087ba8]">
							모든 문제에 답했습니다.
						</p>
					{/if}
					<button
						type="button"
						class={allAnswered
							? 'btn mt-3 w-full ring-2 ring-[#087ba8]/20 ring-offset-2'
							: 'btn mt-5 w-full'}
						aria-describedby={allAnswered ? 'all-answered' : undefined}
						disabled={submitting || Boolean(attempt.pausedAt)}
						onclick={() => (confirm = true)}>답안 제출</button
					>
				</aside>
				{#if q}
					{#key q.id}
						<section
							class="order-1 min-w-0 border border-[#d5dce2] bg-white p-4 shadow-[0_1px_1px_rgba(17,24,32,0.02)] sm:p-6 md:order-2"
						>
							<div class="border-b-2 border-[#34404d] pb-6">
								<div class="flex items-baseline justify-between">
									<p class="font-mono text-sm font-bold text-[#087ba8]">문제 {index + 1}</p>
									<span class="text-sm font-semibold text-[#52616e]">{q.points}점 문제</span>
								</div>
								<h1
									id="exam-question-heading"
									tabindex="-1"
									class="mt-4 scroll-mt-28 text-base leading-7 font-medium whitespace-pre-wrap sm:text-lg sm:leading-8"
								>
									{#each q.content.split(/\n\s*\n|\n(?=\s*(?:\d+[.)]|[①-⑳]|\[))/) as paragraph}<span
											class="mb-3 block last:mb-0">{paragraph}</span
										>{/each}
								</h1>
								<button
									type="button"
									class="btn-secondary mt-4 aria-pressed:border-[#b45309] aria-pressed:bg-[#fff7ed] aria-pressed:text-[#92400e]"
									aria-pressed={reviewIds.includes(q.id)}
									disabled={answerLocked}
									onclick={toggleReview}
									>{reviewIds.includes(q.id) ? '다시 보기 해제' : '나중에 다시 보기'}</button
								>
							</div>
							{#if q.type === 'multiple'}
								<div class="mt-5 border border-[#cfd8df]">
									{#each q.options as option, i}<label
											class="flex cursor-pointer gap-3 border-b border-[#dfe4e9] bg-white px-4 py-3 last:border-0 hover:bg-[#f5fbfd]"
											>{#if q.allowsMultipleAnswers}
												<input
													type="checkbox"
													name={q.id}
													value={String(i)}
													disabled={answerLocked}
													checked={selectedChoiceIndices(values[q.id]).includes(i)}
													onchange={() => selectChoice(i)}
													class="mt-0.5"
												/>
											{:else}
												<input
													type="radio"
													name={q.id}
													value={String(i)}
													disabled={answerLocked}
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
									class="mt-5 w-full leading-7"
									rows={q.type === 'short' ? 3 : longEssay ? 10 : 6}
									maxlength="10000"
									aria-describedby="answer-limit"
									bind:value={values[q.id]}
									disabled={answerLocked}
									oninput={() => save(q.id)}
									placeholder={q.type === 'short'
										? '답변을 입력하세요.'
										: '핵심 내용을 중심으로 답변을 작성하세요.'}></textarea>
								<p id="answer-limit" class="mt-2 text-xs text-[#6a7684]">
									최대 10,000자 · {(values[q.id] ?? '').length.toLocaleString('ko-KR')}자 작성
								</p>{/if}
							<div class="mt-8 flex justify-between border-t-2 border-[#34404d] pt-5">
								<button
									type="button"
									class="btn-secondary"
									disabled={index === 0 || answerLocked}
									onclick={() => goToQuestion(index - 1)}>← 이전 문제</button
								>
								<button
									type="button"
									class="btn-secondary"
									disabled={index === attempt.questions.length - 1 || answerLocked}
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
			class="max-h-[85dvh] max-w-md overflow-y-auto overscroll-contain rounded-lg bg-white p-0 shadow-[0_24px_64px_rgba(17,24,32,0.28)]"
		>
			<div class="border-b border-[#dfe4e9] px-6 py-4">
				<p class="text-sm font-semibold">답안 제출 확인</p>
			</div>
			<div class="p-6">
				<AlertDialog.Title class="text-xl font-bold">답안을 제출할까요?</AlertDialog.Title>
				<AlertDialog.Description class="mt-4 text-sm leading-6 text-[#6a7684]">
					제출 후에는 답안을 수정하거나 다시 응시할 수 없습니다.<br />아직 답하지 않은 문제:
					<b>{attempt.questions.filter((item) => !values[item.id]?.trim()).length}개</b>
				</AlertDialog.Description>
				{#if unansweredQuestions.length}
					<div class="mt-4">
						<p class="text-sm font-semibold">아직 답하지 않은 문제로 돌아가기</p>
						<div class="mt-2 flex flex-wrap gap-2">
							{#each unansweredQuestions as { i }}<button
									type="button"
									class="btn-secondary"
									onclick={() => goToQuestion(i)}>{i + 1}번</button
								>{/each}
						</div>
					</div>
				{/if}
				{#if reviewQuestions.length}
					<div class="mt-4">
						<p class="text-sm font-semibold">나중에 다시 볼 문제 {reviewQuestions.length}개</p>
						<div class="mt-2 flex flex-wrap gap-2">
							{#each reviewQuestions as { i }}<button
									type="button"
									class="btn-secondary"
									onclick={() => goToQuestion(i)}>{i + 1}번</button
								>{/each}
						</div>
					</div>
				{/if}
				<div class="mt-7 flex justify-end gap-2">
					<AlertDialog.Cancel class="btn-secondary">계속 작성</AlertDialog.Cancel>
					<button type="button" class="btn" disabled={submitting} onclick={() => submit()}>
						{submitting ? '답안을 저장하는 중…' : '제출하기'}
					</button>
				</div>
			</div>
		</AlertDialog.Content>
	</AlertDialog.Root>
{/if}
