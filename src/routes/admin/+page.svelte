<script lang="ts">
	import { pushState } from '$app/navigation';
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { codeStatusLabel, questionTypeLabel } from '$lib/admin/presentation';
	import QuestionEditor from '$lib/components/question-editor.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';

	type ConflictQuestion = {
		id: string;
		type: string;
		content: string;
		options: string[] | null;
		correctAnswer: number | null;
		correctAnswers: number[] | null;
		points: number;
		updatedAt: Date;
		revision: number;
	};
	type QuestionConflict = {
		latest: ConflictQuestion;
		draft: Omit<ConflictQuestion, 'id' | 'updatedAt' | 'revision'>;
	};
	type AdminForm = {
		message?: string;
		success?: string;
		conflict?: QuestionConflict;
	};
	type AdminSection = 'overview' | 'results' | 'codes' | 'questions' | 'question-new';

	let { data: initialData, form } = $props();
	let data = $state(untrack(() => initialData));
	const sectionOf = (payload: typeof initialData) => payload.section;
	const tab = $derived(sectionOf(data));
	const activeSection = $derived(tab);
	let editingQuestion = $state(false);
	let deleteQuestionOpen = $state(false);
	let dismissedConflictRevision = $state<number | null>(null);
	let conflictForEditing = $state<QuestionConflict | null>(null);
	const actionForm = $derived((form ?? {}) as AdminForm);
	const questionConflict = $derived((actionForm.conflict ?? null) as QuestionConflict | null);
	const activeQuestionConflict = $derived(
		questionConflict && questionConflict.latest.revision !== dismissedConflictRevision
			? questionConflict
			: null
	);
	const partialScore = (points: number) => points / 2;
	const correctOptionIndices = (question: {
		correctAnswer: number | null;
		correctAnswers?: number[] | null;
	}) =>
		question.correctAnswers?.length
			? question.correctAnswers
			: question.correctAnswer === null
				? []
				: [question.correctAnswer];
	function answerOptionIndices(value: string) {
		try {
			const parsed = JSON.parse(value);
			if (Array.isArray(parsed)) return parsed.filter(Number.isInteger);
		} catch {
			// 단일정답은 숫자 문자열로 저장됩니다.
		}
		const choice = Number(value);
		return Number.isInteger(choice) ? [choice] : [];
	}

	$effect(() => {
		if (actionForm.conflict) return;
		const message = actionForm.success ?? actionForm.message;
		if (!message) return;
		if (actionForm.success) toast.success(message);
		else toast.error(message);
	});

	function reviveDates(value: unknown): unknown {
		if (Array.isArray(value)) return value.map(reviveDates);
		if (!value || typeof value !== 'object') return value;
		return Object.fromEntries(
			Object.entries(value).map(([name, item]) => [
				name,
				name.endsWith('At') && typeof item === 'string' ? new Date(item) : reviveDates(item)
			])
		);
	}

	async function fetchSection(section: AdminSection, search = '') {
		const response = await fetch(`/api/admin/${section}${search}`);
		if (!response.ok) throw new Error('관리자 데이터를 불러오지 못했습니다.');
		return reviveDates(await response.json()) as typeof initialData;
	}

	function openQuestion(event: MouseEvent, question: NonNullable<typeof data.questions>[number]) {
		event.preventDefault();
		if (tab !== 'questions' || !data.questions) return;
		editingQuestion = false;
		data = { ...data, selectedQuestion: question } as typeof initialData;
		deleteQuestionOpen = false;
		pushState(`/admin/questions?question=${question.id}#question-detail`, {});
		void refreshQuestionList(question.id);
	}

	function closeQuestion(event: MouseEvent) {
		event.preventDefault();
		if (tab !== 'questions') return;
		editingQuestion = false;
		deleteQuestionOpen = false;
		data = { ...data, selectedQuestion: null } as typeof initialData;
		pushState('/admin/questions', {});
	}

	function continueEditingConflict(conflict: QuestionConflict) {
		conflictForEditing = conflict;
		dismissedConflictRevision = conflict.latest.revision;
		editingQuestion = true;
	}

	function applyLatestQuestion(conflict: QuestionConflict) {
		if (!data.selectedQuestion) return;
		data = {
			...data,
			selectedQuestion: { ...data.selectedQuestion, ...conflict.latest }
		} as typeof initialData;
		conflictForEditing = null;
		dismissedConflictRevision = conflict.latest.revision;
		editingQuestion = false;
	}

	async function refreshQuestionList(selectedQuestionId: string) {
		try {
			const refreshed = await fetchSection(
				'questions',
				`?question=${encodeURIComponent(selectedQuestionId)}`
			);
			if (
				tab === 'questions' &&
				new URL(location.href).searchParams.get('question') === selectedQuestionId
			) {
				data = refreshed;
			}
		} catch {
			// The cached list is still usable; a future tab visit will retry the refresh.
		}
	}
</script>

<main class="min-h-screen bg-[#f5f6f8]">
	<header class="site-header">
		<div class="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 sm:px-8">
			<div>
				<a href="/exam" class="wordmark">OWKR EXAM</a>
				<span class="ml-3 text-xs text-[#6a7684]">시험 관리</span>
			</div>
			<a class="text-xs font-semibold text-[#087ba8] underline underline-offset-4" href="/exam"
				>응시 화면</a
			>
		</div>
	</header>

	<div class="mx-auto max-w-[1440px] px-5 pb-12 sm:px-8">
		<section class="flex items-end justify-between py-7 sm:py-9">
			<div>
				<p class="eyebrow">ADMINISTRATION</p>
				<h1 class="mt-2 text-3xl font-bold tracking-[-.04em]">시험 관리</h1>
			</div>
			<span class="hidden text-xs text-[#6a7684] sm:block">문제 · 응시 코드 · 결과 관리</span>
		</section>

		<div class="lg:grid lg:grid-cols-[184px_minmax(0,1fr)] lg:gap-10">
			<nav
				class="-mx-5 mb-2 flex overflow-x-auto border-b border-[#d9dee5] px-5 lg:sticky lg:top-6 lg:mx-0 lg:mb-0 lg:h-fit lg:flex-col lg:overflow-visible lg:border-0 lg:px-0"
				aria-label="관리자 메뉴"
			>
				<a
					href="/admin/overview"
					data-sveltekit-reload
					class="shrink-0 border-b-2 px-5 py-3 text-sm font-semibold transition-colors lg:border-b-0 lg:border-l-2 lg:px-4"
					class:border-[#087ba8]={activeSection === 'overview'}
					class:text-[#087ba8]={activeSection === 'overview'}
					class:bg-[#eaf7fb]={activeSection === 'overview'}
					class:border-transparent={activeSection !== 'overview'}
					aria-current={activeSection === 'overview' ? 'page' : undefined}>개요</a
				>
				<a
					href="/admin/results"
					data-sveltekit-reload
					class="shrink-0 border-b-2 px-5 py-3 text-sm font-semibold transition-colors lg:border-b-0 lg:border-l-2 lg:px-4"
					class:border-[#087ba8]={activeSection === 'results'}
					class:text-[#087ba8]={activeSection === 'results'}
					class:bg-[#eaf7fb]={activeSection === 'results'}
					class:border-transparent={activeSection !== 'results'}
					aria-current={activeSection === 'results' ? 'page' : undefined}>응시 결과</a
				>
				<a
					href="/admin/codes"
					data-sveltekit-reload
					class="shrink-0 border-b-2 px-5 py-3 text-sm font-semibold transition-colors lg:border-b-0 lg:border-l-2 lg:px-4"
					class:border-[#087ba8]={activeSection === 'codes'}
					class:text-[#087ba8]={activeSection === 'codes'}
					class:bg-[#eaf7fb]={activeSection === 'codes'}
					class:border-transparent={activeSection !== 'codes'}
					aria-current={activeSection === 'codes' ? 'page' : undefined}>응시 코드</a
				>
				<a
					href="/admin/questions"
					data-sveltekit-reload
					class="shrink-0 border-b-2 px-5 py-3 text-sm font-semibold transition-colors lg:border-b-0 lg:border-l-2 lg:px-4"
					class:border-[#087ba8]={activeSection === 'questions'}
					class:text-[#087ba8]={activeSection === 'questions'}
					class:bg-[#eaf7fb]={activeSection === 'questions'}
					class:border-transparent={activeSection !== 'questions'}
					aria-current={activeSection === 'questions' ? 'page' : undefined}>문제 관리</a
				>
				<a
					href="/admin/question-new"
					data-sveltekit-reload
					class="shrink-0 border-b-2 px-5 py-3 text-sm font-semibold transition-colors lg:border-b-0 lg:border-l-2 lg:px-4"
					class:border-[#087ba8]={activeSection === 'question-new'}
					class:text-[#087ba8]={activeSection === 'question-new'}
					class:bg-[#eaf7fb]={activeSection === 'question-new'}
					class:border-transparent={activeSection !== 'question-new'}
					aria-current={activeSection === 'question-new' ? 'page' : undefined}>문제 등록</a
				>
			</nav>

			<div class="min-w-0">
				{#if tab === 'overview' && data.overview}
					<section class="py-8">
						<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
							<div class="card p-5">
								<p class="text-xs font-semibold text-[#6a7684]">채점 필요</p>
								<p class="mt-2 font-mono text-3xl font-bold text-[#087ba8]">
									{data.overview.needsGradingCount}
								</p>
								<p class="mt-1 text-xs text-[#6a7684]">제출된 답안 중 검토 대기</p>
							</div>
							<div class="card p-5">
								<p class="text-xs font-semibold text-[#6a7684]">응시 중</p>
								<p class="mt-2 font-mono text-3xl font-bold">{data.overview.inProgress}</p>
								<p class="mt-1 text-xs text-[#6a7684]">제출 전 시험 진행 중</p>
							</div>
							<div class="card p-5">
								<p class="text-xs font-semibold text-[#6a7684]">채점 완료</p>
								<p class="mt-2 font-mono text-3xl font-bold">{data.overview.completed}</p>
								<p class="mt-1 text-xs text-[#6a7684]">최종 점수 확정</p>
							</div>
							<div class="card p-5">
								<p class="text-xs font-semibold text-[#6a7684]">미사용 코드</p>
								<p class="mt-2 font-mono text-3xl font-bold">{data.overview.unusedCodes}</p>
								<p class="mt-1 text-xs text-[#6a7684]">새 응시자에게 발급 가능</p>
							</div>
						</div>

						<div class="mt-8 grid gap-8 lg:grid-cols-[1fr_.8fr]">
							<section>
								<div class="mb-3 flex items-center justify-between">
									<div>
										<h2 class="text-lg font-bold">채점이 필요한 응시자</h2>
										<p class="mt-1 text-xs text-[#6a7684]">제출된 순서대로 확인하세요.</p>
									</div>
									<a
										href="/admin/results"
										data-sveltekit-reload
										class="text-xs font-semibold text-[#087ba8] underline underline-offset-4"
										>전체 결과</a
									>
								</div>
								<div class="border-ink overflow-x-auto border-t">
									<table class="w-full min-w-[560px] text-left text-sm">
										<thead class="table-head"
											><tr
												><th class="p-3">지원자</th><th class="p-3">제출 시각</th><th class="p-3"
													>객관식</th
												><th class="p-3"></th></tr
											></thead
										><tbody
											>{#each data.overview.needsGrading as attempt}<tr class="border-line border-b"
													><td class="p-3 font-semibold">{attempt.displayName}</td><td
														class="p-3 text-xs text-[#6a7684]"
														>{attempt.submittedAt?.toLocaleString('ko-KR')}</td
													><td class="p-3">{attempt.objectiveScore}</td><td class="p-3"
														><a
															href={`/admin/results?attempt=${attempt.id}`}
															data-sveltekit-reload
															class="text-xs font-bold text-[#087ba8] underline underline-offset-4"
															>채점하기</a
														></td
													></tr
												>{:else}<tr
													><td colspan="4" class="p-6 text-center text-sm text-[#6a7684]"
														>현재 채점이 필요한 답안이 없습니다.</td
													></tr
												>{/each}</tbody
										>
									</table>
								</div>
							</section>
							<section>
								<div class="mb-3 flex items-center justify-between">
									<div>
										<h2 class="text-lg font-bold">최근 발급 코드</h2>
										<p class="mt-1 text-xs text-[#6a7684]">최근 생성된 응시 코드입니다.</p>
									</div>
									<a
										href="/admin/codes"
										data-sveltekit-reload
										class="text-xs font-semibold text-[#087ba8] underline underline-offset-4"
										>코드 관리</a
									>
								</div>
								<div class="border-ink overflow-x-auto border-t">
									<table class="w-full min-w-[460px] text-left text-sm">
										<thead class="table-head"
											><tr
												><th class="p-3">코드</th><th class="p-3">상태</th><th class="p-3"
													>발급 시각</th
												></tr
											></thead
										><tbody
											>{#each data.overview.recentCodes as item}<tr class="border-line border-b"
													><td class="p-3 font-mono font-bold tracking-widest">{item.code}</td><td
														class="p-3"
														><span class="badge">{codeStatusLabel(item.status, item.reusable)}</span
														></td
													><td class="p-3 text-xs text-[#6a7684]"
														>{item.createdAt.toLocaleString('ko-KR')}</td
													></tr
												>{:else}<tr
													><td colspan="3" class="p-6 text-center text-sm text-[#6a7684]"
														>발급한 코드가 없습니다.</td
													></tr
												>{/each}</tbody
										>
									</table>
								</div>
							</section>
						</div>
					</section>
				{:else if tab === 'question-new'}
					<section class="py-8">
						<div class="mb-5 max-w-3xl">
							<h2 class="text-lg font-bold">새 문제 등록</h2>
							<p class="mt-1 text-xs leading-5 text-stone-500">
								문제 유형을 먼저 고르면 필요한 항목만 표시됩니다. 이미 시험을 시작한 응시자의 문제
								사본은 바뀌지 않습니다.
							</p>
						</div>
						<QuestionEditor action="?/question" />
					</section>
				{:else if tab === 'questions'}
					<section class="py-8">
						<div class="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
							{#if data.selectedQuestion}
								<article
									id="question-detail"
									class="border-line scroll-mt-5 border-t-2 border-t-[#111820] bg-white px-5 pt-5 pb-6 sm:px-6 lg:sticky lg:top-6 lg:order-2 lg:h-fit"
								>
									<div class="flex flex-wrap items-center justify-between gap-3">
										<div class="flex flex-wrap items-center gap-2">
											<span class="font-mono text-xs font-bold text-[#087ba8]"
												>문제 {data.selectedQuestion.sortOrder}</span
											>
											<span class="badge">{questionTypeLabel(data.selectedQuestion.type)}</span>
											{#if !data.selectedQuestion.active}<span
													class="text-xs font-semibold text-stone-500">비활성</span
												>{/if}
										</div>
										<div class="flex w-full flex-wrap items-center justify-between gap-3">
											<div class="flex items-center gap-2">
												<button
													type="button"
													class="text-xs font-semibold text-[#087ba8] underline underline-offset-4"
													onclick={() => {
														editingQuestion = !editingQuestion;
														if (!editingQuestion) conflictForEditing = null;
													}}>{editingQuestion ? '수정 취소' : '문제 수정'}</button
												>
												<a
													href="/admin/questions"
													onclick={closeQuestion}
													class="btn-secondary h-8 px-3 text-xs">상세 닫기</a
												>
											</div>
											<button
												type="button"
												onclick={() => (deleteQuestionOpen = true)}
												class="h-8 border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 transition hover:bg-red-100"
											>
												문제 삭제
											</button>
										</div>
									</div>
									<p class="text-muted mt-3 text-xs">
										마지막 수정 · {data.selectedQuestion.updatedByName ||
											'수정 이력 없음'}{#if data.selectedQuestion.updatedByName}
											· {data.selectedQuestion.updatedAt.toLocaleString('ko-KR')}{/if}
									</p>
									{#if editingQuestion}
										<div class="mt-5">
											<QuestionEditor
												action="?/updateQuestion"
												question={conflictForEditing?.latest ?? data.selectedQuestion}
												draft={conflictForEditing?.draft ?? null}
												submitLabel="수정 내용 저장"
											/>
										</div>
									{:else}
										<h2
											class="mt-5 text-lg leading-8 font-bold tracking-[-.02em] whitespace-pre-wrap"
										>
											{data.selectedQuestion.content}
										</h2>
										<div
											class="border-line bg-line mt-5 grid grid-cols-2 gap-px border text-sm sm:grid-cols-4"
										>
											<div class="bg-[#f7f8fa] p-3">
												<p class="text-muted text-[10px] font-semibold">유형</p>
												<p class="mt-1 font-semibold">
													{questionTypeLabel(data.selectedQuestion.type)}
												</p>
											</div>
											<div class="bg-[#f7f8fa] p-3">
												<p class="text-muted text-[10px] font-semibold">배점</p>
												<p class="mt-1 font-semibold">{data.selectedQuestion.points}점</p>
											</div>
											<div class="bg-[#f7f8fa] p-3">
												<p class="text-muted text-[10px] font-semibold">상태</p>
												<p class="mt-1 font-semibold">
													{data.selectedQuestion.active ? '사용 중' : '비활성'}
												</p>
											</div>
											<div class="bg-[#f7f8fa] p-3">
												<p class="text-muted text-[10px] font-semibold">등록 시각</p>
												<p class="mt-1 text-xs font-semibold">
													{data.selectedQuestion.createdAt.toLocaleString('ko-KR')}
												</p>
											</div>
										</div>
										{#if data.selectedQuestion.type === 'multiple' && data.selectedQuestion.options?.length}
											<div class="mt-6">
												<p class="text-xs font-bold text-[#34404d]">보기 및 정답</p>
												<ol class="mt-3 space-y-2">
													{#each data.selectedQuestion.options as option, index}
														<li
															class="flex items-start gap-3 border px-4 py-3 text-sm leading-6"
															class:border-[#087ba8]={correctOptionIndices(
																data.selectedQuestion
															).includes(index)}
															class:bg-[#effbff]={correctOptionIndices(
																data.selectedQuestion
															).includes(index)}
															class:border-line={!correctOptionIndices(
																data.selectedQuestion
															).includes(index)}
														>
															<span
																class="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold"
																class:bg-[#087ba8]={correctOptionIndices(
																	data.selectedQuestion
																).includes(index)}
																class:text-white={correctOptionIndices(
																	data.selectedQuestion
																).includes(index)}
																class:text-[#087ba8]={!correctOptionIndices(
																	data.selectedQuestion
																).includes(index)}>{index + 1}</span
															>
															<span class="flex-1">{option}</span>
															{#if correctOptionIndices(data.selectedQuestion).includes(index)}
																<span
																	class="inline-flex shrink-0 items-center gap-1 rounded-sm bg-[#087ba8] px-2 py-1 text-[10px] leading-none font-bold text-white"
																>
																	<svg
																		viewBox="0 0 12 12"
																		class="h-3 w-3"
																		fill="none"
																		aria-hidden="true"
																	>
																		<path
																			d="m2.25 6.1 2.15 2.15 5.35-5.1"
																			stroke="currentColor"
																			stroke-width="1.7"
																			stroke-linecap="round"
																			stroke-linejoin="round"
																		/>
																	</svg>
																	정답
																</span>
															{/if}
														</li>
													{/each}
												</ol>
											</div>
										{:else}
											<p
												class="mt-5 border-l-2 border-[#087ba8] bg-[#effbff] px-3 py-2 text-xs leading-5 text-[#34404d]"
											>
												이 문제는 관리자가 응시자의 답안을 직접 채점합니다.
											</p>
										{/if}
									{/if}
									<AlertDialog.Root bind:open={deleteQuestionOpen}>
										<AlertDialog.Content
											class="max-w-md rounded-lg bg-white p-6 shadow-[0_24px_64px_rgba(17,24,32,0.28)]"
										>
											<AlertDialog.Header class="place-items-start text-left">
												<AlertDialog.Title class="text-lg font-bold"
													>문제를 삭제할까요?</AlertDialog.Title
												>
												<AlertDialog.Description class="mt-2 text-sm leading-6 text-[#6a7684]">
													{data.selectedQuestion.sortOrder}번은 시험에서 삭제됩니다.<br />
													이미 시작한 응시자의 문제 사본과 채점 결과는 유지됩니다.
												</AlertDialog.Description>
											</AlertDialog.Header>
											<form id="delete-question-form" method="POST" action="?/deleteQuestion">
												<input type="hidden" name="id" value={data.selectedQuestion.id} />
											</form>
											<div class="mt-7 flex justify-end gap-2">
												<AlertDialog.Cancel class="btn-secondary">취소</AlertDialog.Cancel>
												<button
													type="submit"
													form="delete-question-form"
													class="btn bg-red-700 hover:bg-red-800"
												>
													삭제하기
												</button>
											</div>
										</AlertDialog.Content>
									</AlertDialog.Root>
									{#if activeQuestionConflict}
										<AlertDialog.Root open>
											<AlertDialog.Content
												class="max-w-2xl rounded-lg bg-white p-0 shadow-[0_24px_64px_rgba(17,24,32,0.28)]"
											>
												<div class="border-b border-[#e2e7ec] px-6 py-5">
													<AlertDialog.Title class="text-lg font-bold">저장 충돌</AlertDialog.Title>
													<AlertDialog.Description
														class="mt-2 max-w-xl text-sm leading-6 text-[#667788]"
													>
														다른 관리자가 이 문제를 먼저 저장했습니다. 작성한 내용은 유지되어
														있으며, 아래에서 두 버전을 비교한 뒤 선택할 수 있습니다.
													</AlertDialog.Description>
												</div>
												<div class="grid gap-px bg-[#e2e7ec] sm:grid-cols-2">
													<section class="min-w-0 bg-[#f8fafb] p-5">
														<p class="text-xs font-bold text-[#34404d]">최신 저장본</p>
														<p class="mt-1 text-xs text-[#6a7684]">
															{questionTypeLabel(activeQuestionConflict.latest.type)} · {activeQuestionConflict
																.latest.points}점
														</p>
														<p
															class="mt-4 max-h-44 overflow-y-auto text-sm leading-6 whitespace-pre-wrap text-[#34404d]"
														>
															{activeQuestionConflict.latest.content}
														</p>
													</section>
													<section class="min-w-0 bg-white p-5">
														<p class="text-xs font-bold text-[#087ba8]">내가 작성한 내용</p>
														<p class="mt-1 text-xs text-[#6a7684]">
															{questionTypeLabel(activeQuestionConflict.draft.type)} · {activeQuestionConflict
																.draft.points}점
														</p>
														<p
															class="mt-4 max-h-44 overflow-y-auto text-sm leading-6 whitespace-pre-wrap text-[#34404d]"
														>
															{activeQuestionConflict.draft.content}
														</p>
													</section>
												</div>
												<div
													class="flex flex-col-reverse gap-2 border-t border-[#e2e7ec] px-6 py-4 sm:flex-row sm:justify-end"
												>
													<AlertDialog.Action
														class="btn-secondary"
														onclick={() => applyLatestQuestion(activeQuestionConflict)}
													>
														최신 저장본 적용
													</AlertDialog.Action>
													<AlertDialog.Action
														class="btn"
														onclick={() => continueEditingConflict(activeQuestionConflict)}
													>
														내 변경 계속 수정
													</AlertDialog.Action>
												</div>
											</AlertDialog.Content>
										</AlertDialog.Root>
									{/if}
								</article>
							{:else}
								<aside
									class="border-line hidden min-h-[340px] bg-white p-6 lg:order-2 lg:flex lg:flex-col lg:justify-center"
								>
									<p class="text-sm font-bold">문제를 선택하세요</p>
									<p class="text-muted mt-2 text-sm leading-6">
										왼쪽 목록에서 문제를 선택하면 내용과 보기, 수정 기능을 이곳에서 확인할 수
										있습니다.
									</p>
								</aside>
							{/if}
							<div class="border-line bg-white p-5 sm:p-6 lg:order-1">
								<div class="mb-4 flex items-baseline justify-between">
									<h2 class="text-lg font-bold">등록된 문제</h2>
									<span class="text-xs text-stone-500">총 {data.questions?.length ?? 0}문항</span>
								</div>
								<div class="border-ink overflow-x-auto border-t">
									<table class="w-full min-w-[540px] table-fixed text-left text-sm">
										<colgroup
											><col class="w-12" /><col /><col class="w-32" /><col class="w-14" /></colgroup
										>
										<thead class="table-head">
											<tr>
												<th class="p-3">번호</th>
												<th class="p-3">문제</th>
												<th class="p-3">유형</th>
												<th class="p-3">배점</th>
											</tr>
										</thead>
										<tbody>
											{#each data.questions ?? [] as q}
												<tr class="border-line border-b align-top" class:opacity-40={!q.active}>
													<td class="p-3 font-mono">{q.sortOrder}</td>
													<td class="min-w-0 p-3"
														><a
															href={`/admin/questions?question=${q.id}#question-detail`}
															onclick={(event) => openQuestion(event, q)}
															class="text-ink block truncate leading-6 font-semibold underline decoration-[#b7dce9] underline-offset-4 hover:text-[#087ba8]"
															title={q.content}>{q.content}</a
														>
														{#if !q.active}<span
																class="ml-2 text-[10px] font-semibold text-stone-500">비활성</span
															>{/if}
													</td>
													<td class="p-3 whitespace-nowrap">{questionTypeLabel(q.type)}</td>
													<td class="p-3">{q.points}</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							</div>
						</div>
					</section>
				{:else if tab === 'codes'}
					<section class="grid gap-10 py-8 lg:grid-cols-[330px_1fr]">
						<form method="POST" action="?/code" class="border-ink border-t-2 pt-4">
							<h2 class="text-lg font-bold">응시 코드 발급</h2>
							<p class="mt-1 text-xs leading-5 text-stone-500">
								특정 Discord 계정에만 사용할 수 있는 1회용 6자리 코드입니다.
							</p>
							<label class="label mt-6" for="discordId">Discord User ID</label>
							<input
								id="discordId"
								class="w-full font-mono"
								name="discordId"
								placeholder="123456789012345678"
								required
							/>
							<button class="btn mt-5 w-full">코드 발급</button>
						</form>

						<div>
							<div class="mb-3 flex items-baseline justify-between">
								<h2 class="text-lg font-bold">발급 이력</h2>
								<span class="text-xs text-stone-500">총 {data.codes?.length ?? 0}건</span>
							</div>
							<div class="border-ink overflow-x-auto border-t">
								<table class="w-full min-w-[650px] text-left text-sm">
									<thead class="table-head">
										<tr>
											<th class="p-3">코드</th>
											<th class="p-3">대상 Discord ID</th>
											<th class="p-3">상태</th>
											<th class="p-3">발급 시각</th>
											<th class="p-3"></th>
										</tr>
									</thead>
									<tbody>
										{#each data.codes ?? [] as c}
											<tr class="border-line border-b">
												<td class="p-3 font-mono font-bold tracking-widest">{c.code}</td>
												<td class="p-3 font-mono text-xs">{c.discordId}</td>
												<td class="p-3">
													<span class="badge">{codeStatusLabel(c.status, c.reusable)}</span>
												</td>
												<td class="p-3 text-xs">{c.createdAt.toLocaleString('ko-KR')}</td>
												<td class="p-3">
													{#if c.status === 'unused' && !c.reusable}
														<form method="POST" action="?/expireCode">
															<input name="id" type="hidden" value={c.id} />
															<button
																class="text-xs font-bold text-red-700 underline underline-offset-4"
															>
																폐기
															</button>
														</form>
													{/if}
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					</section>
				{:else}
					<section class="py-8">
						{#if data.grading}
							<div class="border-ink mb-10 border-t-2 pt-5">
								<div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
									<div>
										<a
											href="/admin/results"
											data-sveltekit-reload
											class="px-2 py-2 text-xs font-semibold text-[#087ba8] hover:underline"
											>← 응시자 목록</a
										>
										<h2 class="mt-4 text-2xl font-bold tracking-[-.03em]">
											{data.grading.attempt.displayName}
											답안 채점
										</h2>
										<p class="mt-1 font-mono text-xs text-[#6a7684]">
											{data.grading.attempt.discordId}
										</p>
									</div>
									<div class="grid grid-cols-4 border border-[#c8d0d9] bg-white text-center">
										<div class="px-4 py-3">
											<p class="text-[10px] font-semibold text-[#6a7684]">객관식</p>
											<p class="mt-1 font-mono font-bold">
												{data.grading.attempt.objectiveScore}
												/{data.grading.objectiveMaxScore}
											</p>
										</div>
										<div class="border-l border-[#c8d0d9] px-4 py-3">
											<p class="text-[10px] font-semibold text-[#6a7684]">단답형</p>
											<p class="mt-1 font-mono font-bold">
												{data.grading.shortScore ?? '-'}
												/{data.grading.shortMaxScore}
											</p>
										</div>
										<div class="border-l border-[#c8d0d9] px-4 py-3">
											<p class="text-[10px] font-semibold text-[#6a7684]">서술·논술형</p>
											<p class="mt-1 font-mono font-bold">
												{data.grading.essayScore ?? '-'}
												/{data.grading.essayMaxScore}
											</p>
										</div>
										<div class="border-l border-[#c8d0d9] px-4 py-3">
											<p class="text-[10px] font-semibold text-[#6a7684]">총점 · 비공개</p>
											<p class="mt-1 font-mono font-bold">
												{data.grading.attempt.totalScore ?? '-'}
											</p>
											<p
												class="mt-1 text-[10px] font-bold"
												class:text-green-700={data.grading.essayPassed === true}
												class:text-red-700={data.grading.essayPassed === false}
												class:text-[#6a7684]={data.grading.essayPassed === null}
											>
												{data.grading.essayPassed === null
													? '판정 대기'
													: data.grading.essayPassed
														? '기준 충족'
														: '탈락'}
											</p>
										</div>
									</div>
								</div>
								<p
									class="mt-5 border-l-2 border-[#087ba8] bg-[#effbff] px-3 py-2 text-xs leading-5 text-[#34404d]"
								>
									{data.grading.gradedCount}
									/{data.grading.questions.length}문항 채점됨 · 서술·논술형은 {data.grading
										.essayMaxScore}점 만점 중 {data.grading.essayPassScore}점 미만이면 탈락입니다.
									모든 단답형과 서술·논술형 점수가 입력되면 총점이 확정됩니다.
								</p>
								{#if data.grading.objectiveQuestions.length}
									<section class="mt-6">
										<div class="flex items-baseline justify-between gap-3">
											<h3 class="text-base font-bold">객관식 응답</h3>
											<p class="text-xs text-[#6a7684]">응시자가 실제로 선택한 보기입니다.</p>
										</div>
										<div class="mt-3 grid gap-3 lg:grid-cols-2">
											{#each data.grading.objectiveQuestions as q}
												<article class="border border-[#dfe4e9] bg-white p-4">
													<div class="flex items-center justify-between gap-3">
														<p class="font-mono text-xs font-bold text-[#087ba8]">
															문제 {q.sortOrder}
														</p>
														<p class="text-xs text-[#6a7684]">배점 {q.points}점</p>
													</div>
													<p class="mt-3 line-clamp-2 text-sm leading-6 font-semibold">
														{q.content}
													</p>
													{#if q.answer !== '' && answerOptionIndices(q.answer).length}
														<div class="mt-3 border-l-2 border-[#087ba8] bg-[#effbff] px-3 py-2">
															<p class="text-xs font-bold text-[#087ba8]">
																{answerOptionIndices(q.answer)
																	.map((answer) => answer + 1)
																	.join(', ')}번 선택
															</p>
															{#each answerOptionIndices(q.answer) as answer}
																<p class="mt-1 text-sm leading-5 text-[#34404d]">
																	{q.options?.[answer]}
																</p>
															{/each}
														</div>
													{:else}
														<p class="mt-3 text-sm text-[#6a7684]">(미응답)</p>
													{/if}
												</article>
											{/each}
										</div>
									</section>
								{/if}

								<div class="mt-6 space-y-4">
									{#each data.grading.questions as q}
										<article class="card p-5 sm:p-6">
											<div class="flex items-center justify-between gap-3">
												<p class="text-xs font-semibold text-[#087ba8]">
													문제 {q.sortOrder} · {q.type === 'short' ? '단답형' : '서술·논술형'}
												</p>
												<p class="text-xs text-[#6a7684]">
													배점 {q.points}점 · 현재 {q.score ?? '미채점'}
												</p>
											</div>
											<h3 class="mt-4 text-sm leading-6 font-semibold whitespace-pre-wrap">
												{q.content}
											</h3>
											<div
												class="mt-4 min-h-20 border border-[#dfe4e9] bg-[#f7f8fa] p-4 text-sm leading-6 whitespace-pre-wrap text-[#34404d]"
											>
												{q.answer || '(미응답)'}
											</div>
											{#if q.type === 'short'}
												<div
													class="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
												>
													<form method="POST" action="?/grade" class="flex flex-wrap gap-2">
														<input
															type="hidden"
															name="attemptId"
															value={data.grading.attempt.id}
														/><input type="hidden" name="questionId" value={q.id} />
														<button
															name="score"
															value={q.points}
															class="btn-secondary"
															class:border-green-700={q.score === q.points}
															class:text-green-800={q.score === q.points}
															>정답 · {q.points}점
														</button>
														<button
															name="score"
															value="0"
															class="btn-secondary"
															class:border-red-700={q.score === 0}
															class:text-red-800={q.score === 0}
														>
															오답 · 0점
														</button>
													</form>
													<form method="POST" action="?/grade" class="flex items-center gap-2">
														<input type="hidden" name="attemptId" value={data.grading.attempt.id} />
														<input type="hidden" name="questionId" value={q.id} />
														<label class="text-xs font-semibold" for={`score-${q.id}`}
															>직접 입력</label
														>
														<input
															id={`score-${q.id}`}
															name="score"
															type="number"
															step="0.01"
															value={q.score ?? ''}
															required
															class="w-20"
														/>
														<button class="btn-secondary">저장</button>
													</form>
												</div>
											{:else}
												<div
													class="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
												>
													<form method="POST" action="?/grade" class="flex flex-wrap gap-2">
														<input
															type="hidden"
															name="attemptId"
															value={data.grading.attempt.id}
														/><input type="hidden" name="questionId" value={q.id} />
														<button name="score" value={q.points} class="btn-secondary"
															>만점 · {q.points}</button
														>
														<button
															name="score"
															value={partialScore(q.points)}
															class="btn-secondary">부분 · {partialScore(q.points)}</button
														>
														<button name="score" value="0" class="btn-secondary">미충족 · 0</button>
													</form>
													<form method="POST" action="?/grade" class="flex items-center gap-2">
														<input
															type="hidden"
															name="attemptId"
															value={data.grading.attempt.id}
														/><input type="hidden" name="questionId" value={q.id} />
														<label class="text-xs font-semibold" for={`score-${q.id}`}
															>직접 입력</label
														><input
															id={`score-${q.id}`}
															name="score"
															type="number"
															step="0.01"
															value={q.score ?? ''}
															required
															class="w-20"
														/>
														<button class="btn-secondary">저장</button>
													</form>
												</div>
											{/if}
										</article>
									{/each}
								</div>
							</div>
						{/if}

						<div class="mb-3 flex items-baseline justify-between">
							<h2 class="text-lg font-bold">응시 결과</h2>
							<span class="text-xs text-stone-500">총 {data.attempts?.length ?? 0}명</span>
						</div>
						<div class="border-ink overflow-x-auto border-t">
							<table class="w-full min-w-[980px] text-left text-sm">
								<thead class="table-head">
									<tr>
										<th class="p-3">지원자</th>
										<th class="p-3">Discord ID</th>
										<th class="p-3">상태</th>
										<th class="p-3">객관식</th>
										<th class="p-3">단답형</th>
										<th class="p-3">서술·논술형</th>
										<th class="p-3">총점 · 판정</th>
										<th class="p-3">응시 시간</th>
										<th class="p-3"></th>
									</tr>
								</thead>
								<tbody>
									{#each data.attempts ?? [] as a}
										<tr class="border-line border-b">
											<td class="p-3 font-semibold">
												{#if a.submittedAt}
													<a
														href={`/admin/results?attempt=${a.id}`}
														data-sveltekit-reload
														class="text-[#087ba8] underline underline-offset-4">{a.displayName}</a
													>
												{:else}
													{a.displayName}
												{/if}
											</td>
											<td class="p-3 font-mono text-xs">{a.discordId}</td>
											<td class="p-3"
												><span class="badge"
													>{!a.submittedAt
														? '응시 중'
														: a.totalScore === null
															? a.timedOut
																? '시간 초과 · 채점 필요'
																: '채점 필요'
															: a.timedOut
																? '시간 초과 · 채점 완료'
																: '채점 완료'}</span
												>
											</td>
											<td class="p-3">{a.submittedAt ? a.objectiveScore : '-'}</td>
											<td class="p-3">{a.shortScore ?? '-'}</td>
											<td class="p-3">{a.essayScore ?? '-'}</td>
											<td class="p-3 font-bold">
												{a.totalScore ?? '-'}
												{#if a.essayPassed !== null}
													<span
														class="ml-2 text-xs"
														class:text-green-700={a.essayPassed}
														class:text-red-700={!a.essayPassed}
													>
														{a.essayPassed ? '기준 충족' : '탈락'}
													</span>
												{/if}
											</td>
											<td class="p-3 text-xs"
												>{a.submittedAt
													? Math.round((a.submittedAt.getTime() - a.startedAt.getTime()) / 60000) +
														'분'
													: '-'}</td
											>
											<td class="p-3">
												{#if a.submittedAt}<a
														href={`/admin/results?attempt=${a.id}`}
														data-sveltekit-reload
														class="text-xs font-bold text-[#087ba8] underline underline-offset-4"
														>답안 보기</a
													>{/if}
												<form
													method="POST"
													action="?/deleteAttempt"
													onsubmit={(event) => {
														if (
															!confirm(
																`${a.displayName}님의 응시 결과와 답안을 영구 삭제할까요? 연결된 코드는 재사용할 수 없습니다.`
															)
														)
															event.preventDefault();
													}}
												>
													<input type="hidden" name="id" value={a.id} />
													<button
														class="text-xs font-bold text-red-700 underline underline-offset-4"
														>삭제</button
													>
												</form>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</section>
				{/if}
			</div>
		</div>
	</div>
</main>
