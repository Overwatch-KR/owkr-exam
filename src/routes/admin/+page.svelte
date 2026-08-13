<script lang="ts">
	import { preloadData } from '$app/navigation';
	import { onMount } from 'svelte';
	import QuestionEditor from '$lib/components/question-editor.svelte';

	type ConflictQuestion = {
		id: string;
		type: string;
		content: string;
		options: string[] | null;
		correctAnswer: number | null;
		points: number;
		updatedAt: Date;
	};
	type QuestionConflict = {
		latest: ConflictQuestion;
		draft: Omit<ConflictQuestion, 'id' | 'updatedAt'>;
	};
	type AdminForm = {
		message?: string;
		success?: string;
		conflict?: QuestionConflict;
	};

	let { data, form } = $props();
	const tab = $derived(data.section);
	let editingQuestion = $state(false);
	const actionForm = $derived((form ?? {}) as AdminForm);
	const questionConflict = $derived((actionForm.conflict ?? null) as QuestionConflict | null);
	const hasQuestionConflict = $derived(Boolean(questionConflict));
	let toast = $state<{ tone: 'success' | 'error'; message: string } | null>(null);
	const partialScore = (points: number) => Math.max(1, Math.round(points / 2));
	const questionType = (type: string) =>
		type === 'multiple' ? '객관식' : type === 'short' ? '단답형' : '서술·논술형';
	const codeStatus = (status: string, reusable = false) => {
		if (reusable) return '테스트 · 반복 사용';
		return (
			{ unused: '미사용', in_progress: '응시 중', completed: '응시 완료', expired: '만료됨' }[
				status
			] ?? status
		);
	};

	$effect(() => {
		const message = actionForm.success ?? actionForm.message;
		if (!message) return;
		toast = { tone: actionForm.success ? 'success' : 'error', message };
		const timeout = setTimeout(() => (toast = null), 4500);
		return () => clearTimeout(timeout);
	});

	onMount(() => {
		const sections = [
			'/admin/overview',
			'/admin/results',
			'/admin/codes',
			'/admin/questions',
			'/admin/question-new'
		];
		void Promise.all(
			sections
				.filter((section) => section !== `/admin/${tab}`)
				.map(async (section) => {
					try {
						await preloadData(section);
					} catch {
						// A normal navigation will retry if a background preload fails.
					}
				})
		);
	});
</script>

<main class="min-h-screen bg-[#f7f8fa]">
	<header class="site-header">
		<div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
			<div>
				<a href="/exam" class="wordmark">OWKR EXAM</a>
				<span class="ml-3 text-xs text-[#6a7684]">시험 관리</span>
			</div>
			<a class="text-xs font-semibold text-[#087ba8] underline underline-offset-4" href="/exam"
				>응시 화면</a
			>
		</div>
	</header>

	<div class="mx-auto max-w-7xl px-5 pb-10 sm:px-8">
		<section class="flex items-end justify-between py-8">
			<div>
				<p class="eyebrow">ADMINISTRATION</p>
				<h1 class="mt-2 text-3xl font-bold tracking-[-.04em]">시험 관리</h1>
			</div>
			<span class="hidden text-xs text-[#6a7684] sm:block">문제 · 응시 코드 · 결과 관리</span>
		</section>

		<nav class="flex overflow-x-auto border-b border-[#c8d0d9]" aria-label="관리자 메뉴">
			<a
				href="/admin/overview"
				data-sveltekit-preload-data="hover"
				class="shrink-0 border-b-2 px-5 py-3 text-sm font-semibold transition-colors"
				class:border-[#087ba8]={tab === 'overview'}
				class:text-[#087ba8]={tab === 'overview'}
				class:border-transparent={tab !== 'overview'}
				aria-current={tab === 'overview' ? 'page' : undefined}>개요</a
			>
			<a
				href="/admin/results"
				data-sveltekit-preload-data="hover"
				class="shrink-0 border-b-2 px-5 py-3 text-sm font-semibold transition-colors"
				class:border-[#087ba8]={tab === 'results'}
				class:text-[#087ba8]={tab === 'results'}
				class:border-transparent={tab !== 'results'}
				aria-current={tab === 'results' ? 'page' : undefined}>응시 결과</a
			>
			<a
				href="/admin/codes"
				data-sveltekit-preload-data="hover"
				class="shrink-0 border-b-2 px-5 py-3 text-sm font-semibold transition-colors"
				class:border-[#087ba8]={tab === 'codes'}
				class:text-[#087ba8]={tab === 'codes'}
				class:border-transparent={tab !== 'codes'}
				aria-current={tab === 'codes' ? 'page' : undefined}>응시 코드</a
			>
			<a
				href="/admin/questions"
				data-sveltekit-preload-data="hover"
				class="shrink-0 border-b-2 px-5 py-3 text-sm font-semibold transition-colors"
				class:border-[#087ba8]={tab === 'questions'}
				class:text-[#087ba8]={tab === 'questions'}
				class:border-transparent={tab !== 'questions'}
				aria-current={tab === 'questions' ? 'page' : undefined}>문제 관리</a
			>
			<a
				href="/admin/question-new"
				data-sveltekit-preload-data="hover"
				class="shrink-0 border-b-2 px-5 py-3 text-sm font-semibold transition-colors"
				class:border-[#087ba8]={tab === 'question-new'}
				class:text-[#087ba8]={tab === 'question-new'}
				class:border-transparent={tab !== 'question-new'}
				aria-current={tab === 'question-new' ? 'page' : undefined}>문제 등록</a
			>
		</nav>

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
								class="text-xs font-semibold text-[#087ba8] underline underline-offset-4"
								>코드 관리</a
							>
						</div>
						<div class="border-ink overflow-x-auto border-t">
							<table class="w-full min-w-[460px] text-left text-sm">
								<thead class="table-head"
									><tr
										><th class="p-3">코드</th><th class="p-3">상태</th><th class="p-3">발급 시각</th
										></tr
									></thead
								><tbody
									>{#each data.overview.recentCodes as item}<tr class="border-line border-b"
											><td class="p-3 font-mono font-bold tracking-widest">{item.code}</td><td
												class="p-3"
												><span class="badge">{codeStatus(item.status, item.reusable)}</span></td
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
				<div class="min-w-0">
					{#if data.selectedQuestion}
						<article
							id="question-detail"
							class="border-ink mb-8 scroll-mt-5 border-t-2 bg-white px-5 pt-5 pb-6 sm:px-6"
						>
							<div class="flex flex-wrap items-center justify-between gap-3">
								<div class="flex flex-wrap items-center gap-2">
									<span class="font-mono text-xs font-bold text-[#087ba8]"
										>문제 {data.selectedQuestion.sortOrder}</span
									>
									<span class="badge">{questionType(data.selectedQuestion.type)}</span>
									{#if !data.selectedQuestion.active}<span
											class="text-xs font-semibold text-stone-500">비활성</span
										>{/if}
								</div>
								<div class="flex items-center gap-3">
									{#if questionConflict}
										<a
											href={`/admin/questions?question=${data.selectedQuestion.id}#question-detail`}
											class="text-xs font-semibold text-[#087ba8] underline underline-offset-4"
											>최신본으로 돌아가기</a
										>
									{:else}
										<button
											type="button"
											class="text-xs font-semibold text-[#087ba8] underline underline-offset-4"
											onclick={() => (editingQuestion = !editingQuestion)}
											>{editingQuestion ? '수정 취소' : '문제 수정'}</button
										>
									{/if}
									<a
										href="/admin/questions"
										class="text-xs font-semibold text-[#087ba8] underline underline-offset-4"
										>상세 닫기</a
									>
								</div>
							</div>
							<p class="text-muted mt-3 text-xs">
								마지막 수정 · {data.selectedQuestion.updatedByName ||
									'수정 이력 없음'}{#if data.selectedQuestion.updatedByName}
									· {data.selectedQuestion.updatedAt.toLocaleString('ko-KR')}{/if}
							</p>
							{#if editingQuestion || hasQuestionConflict}
								<div class="mt-5">
									{#if questionConflict}
										<div class="mb-5 border-l-2 border-amber-600 bg-amber-50 px-4 py-4">
											<p class="text-sm font-bold text-amber-900">수정 충돌이 감지되었습니다</p>
											<p class="mt-1 text-xs leading-5 text-amber-800">
												아래 편집칸에는 내가 작성한 내용이 유지됩니다. 최신 저장본을 확인한 뒤
												필요한 부분만 반영해 다시 저장하세요.
											</p>
											<div class="mt-4 grid gap-3 sm:grid-cols-2">
												<div class="border border-amber-200 bg-white p-3">
													<p class="text-[10px] font-bold tracking-wide text-amber-800">
														최신 저장본
													</p>
													<p class="mt-2 text-xs text-[#6a7684]">
														{questionType(questionConflict.latest.type)} · {questionConflict.latest
															.points}점
													</p>
													<p class="mt-2 text-sm leading-6 whitespace-pre-wrap">
														{questionConflict.latest.content}
													</p>
												</div>
												<div class="border border-amber-200 bg-white p-3">
													<p class="text-[10px] font-bold tracking-wide text-amber-800">
														내가 작성한 내용
													</p>
													<p class="mt-2 text-xs text-[#6a7684]">
														{questionType(questionConflict.draft.type)} · {questionConflict.draft
															.points}점
													</p>
													<p class="mt-2 text-sm leading-6 whitespace-pre-wrap">
														{questionConflict.draft.content}
													</p>
												</div>
											</div>
										</div>
									{/if}
									<QuestionEditor
										action="?/updateQuestion"
										question={questionConflict?.latest ?? data.selectedQuestion}
										draft={questionConflict?.draft ?? null}
										submitLabel="수정 내용 저장"
									/>
								</div>
							{:else}
								<h2 class="mt-5 text-lg leading-8 font-bold tracking-[-.02em] whitespace-pre-wrap">
									{data.selectedQuestion.content}
								</h2>
								<div
									class="border-line bg-line mt-5 grid grid-cols-2 gap-px border text-sm sm:grid-cols-4"
								>
									<div class="bg-[#f7f8fa] p-3">
										<p class="text-muted text-[10px] font-semibold">유형</p>
										<p class="mt-1 font-semibold">{questionType(data.selectedQuestion.type)}</p>
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
													class:border-[#087ba8]={data.selectedQuestion.correctAnswer === index}
													class:bg-[#effbff]={data.selectedQuestion.correctAnswer === index}
													class:border-line={data.selectedQuestion.correctAnswer !== index}
												>
													<span
														class="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold"
														class:bg-[#087ba8]={data.selectedQuestion.correctAnswer === index}
														class:text-white={data.selectedQuestion.correctAnswer === index}
														class:text-[#087ba8]={data.selectedQuestion.correctAnswer !== index}
														>{index + 1}</span
													>
													<span class="flex-1">{option}</span>
													{#if data.selectedQuestion.correctAnswer === index}
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
						</article>
					{/if}
					<div class="mb-3 flex items-baseline justify-between">
						<h2 class="text-lg font-bold">등록된 문제</h2>
						<span class="text-xs text-stone-500">총 {data.questions?.length ?? 0}문항</span>
					</div>
					<div class="border-ink overflow-x-auto border-t">
						<table class="w-full min-w-[820px] table-fixed text-left text-sm">
							<colgroup
								><col class="w-14" /><col /><col class="w-28" /><col class="w-16" /><col
									class="w-36"
								/><col class="w-28" /></colgroup
							>
							<thead class="table-head">
								<tr>
									<th class="p-3">번호</th>
									<th class="p-3">문제</th>
									<th class="p-3">유형</th>
									<th class="p-3">배점</th>
									<th class="p-3">마지막 수정</th>
									<th class="p-3"></th>
								</tr>
							</thead>
							<tbody>
								{#each data.questions ?? [] as q}
									<tr class="border-line border-b align-top" class:opacity-40={!q.active}>
										<td class="p-3 font-mono">{q.sortOrder}</td>
										<td class="min-w-0 p-3"
											><a
												href={`/admin/questions?question=${q.id}#question-detail`}
												class="text-ink block truncate leading-6 font-semibold underline decoration-[#b7dce9] underline-offset-4 hover:text-[#087ba8]"
												title={q.content}>{q.content}</a
											>
											{#if !q.active}<span class="ml-2 text-[10px] font-semibold text-stone-500"
													>비활성</span
												>{/if}
										</td>
										<td class="p-3">{questionType(q.type)}</td>
										<td class="p-3">{q.points}</td>
										<td class="p-3"
											><span
												class="block truncate text-xs font-semibold"
												title={q.updatedByName || '수정 이력 없음'}
												>{q.updatedByName || '수정 이력 없음'}</span
											>{#if q.updatedByName}<span class="text-muted mt-1 block text-[10px]"
													>{q.updatedAt.toLocaleString('ko-KR')}</span
												>{/if}</td
										>
										<td class="p-3">
											<div class="flex items-center gap-3">
												<a
													href={`/admin/questions?question=${q.id}#question-detail`}
													class="text-xs font-bold text-[#087ba8] underline underline-offset-4"
													>상세</a
												>
												<form method="POST" action="?/deleteQuestion">
													<input type="hidden" name="id" value={q.id} />
													<button
														class="text-xs font-bold text-red-700 underline underline-offset-4"
													>
														삭제
													</button>
												</form>
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
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
											<span class="badge">{codeStatus(c.status, c.reusable)}</span>
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
									class="text-xs font-semibold text-[#087ba8] underline underline-offset-4"
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
							<div class="grid grid-cols-3 border border-[#c8d0d9] bg-white text-center">
								<div class="px-4 py-3">
									<p class="text-[10px] font-semibold text-[#6a7684]">객관식</p>
									<p class="mt-1 font-mono font-bold">
										{data.grading.attempt.objectiveScore}
										/{data.grading.objectiveMaxScore}
									</p>
								</div>
								<div class="border-x border-[#c8d0d9] px-4 py-3">
									<p class="text-[10px] font-semibold text-[#6a7684]">주관식</p>
									<p class="mt-1 font-mono font-bold">
										{data.grading.attempt.subjectiveScore ?? '-'}
										/{data.grading.subjectiveMaxScore}
									</p>
								</div>
								<div class="px-4 py-3">
									<p class="text-[10px] font-semibold text-[#6a7684]">총점 · 비공개</p>
									<p class="mt-1 font-mono font-bold">{data.grading.attempt.totalScore ?? '-'}</p>
								</div>
							</div>
						</div>
						<p
							class="mt-5 border-l-2 border-[#087ba8] bg-[#effbff] px-3 py-2 text-xs leading-5 text-[#34404d]"
						>
							{data.grading.gradedCount}
							/{data.grading.questions.length}문항 채점됨 · 모든 주관식 문항의 점수가 입력되면
							주관식 점수와 총점이 자동 확정됩니다.
						</p>

						<div class="mt-6 space-y-4">
							{#each data.grading.questions as q, index}
								<article class="card p-5 sm:p-6">
									<div class="flex items-center justify-between gap-3">
										<p class="text-xs font-semibold text-[#087ba8]">
											주관식 {index + 1}
											· {q.type === 'short' ? '단답형' : '서술·논술형'}
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
												<label class="text-xs font-semibold" for={`score-${q.id}`}>직접 입력</label>
												<input
													id={`score-${q.id}`}
													name="score"
													type="number"
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
												<button name="score" value={partialScore(q.points)} class="btn-secondary"
													>부분 · {partialScore(q.points)}</button
												>
												<button name="score" value="0" class="btn-secondary">미충족 · 0</button>
											</form>
											<form method="POST" action="?/grade" class="flex items-center gap-2">
												<input
													type="hidden"
													name="attemptId"
													value={data.grading.attempt.id}
												/><input type="hidden" name="questionId" value={q.id} />
												<label class="text-xs font-semibold" for={`score-${q.id}`}>직접 입력</label
												><input
													id={`score-${q.id}`}
													name="score"
													type="number"
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
					<table class="w-full min-w-[850px] text-left text-sm">
						<thead class="table-head">
							<tr>
								<th class="p-3">지원자</th>
								<th class="p-3">Discord ID</th>
								<th class="p-3">상태</th>
								<th class="p-3">객관식</th>
								<th class="p-3">주관식</th>
								<th class="p-3">총점</th>
								<th class="p-3">응시 시간</th>
								<th class="p-3"></th>
							</tr>
						</thead>
						<tbody>
							{#each data.attempts ?? [] as a}
								<tr class="border-line border-b">
									<td class="p-3 font-semibold">{a.displayName}</td>
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
									<td class="p-3">{a.subjectiveScore ?? '-'}</td>
									<td class="p-3 font-bold">{a.totalScore ?? '-'}</td>
									<td class="p-3 text-xs"
										>{a.submittedAt
											? Math.round((a.submittedAt.getTime() - a.startedAt.getTime()) / 60000) + '분'
											: '-'}</td
									>
									<td class="p-3">
										{#if a.submittedAt}<a
												href={`/admin/results?attempt=${a.id}`}
												class="text-xs font-bold text-[#087ba8] underline underline-offset-4"
												>답안 채점</a
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
											<button class="text-xs font-bold text-red-700 underline underline-offset-4"
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
</main>

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
				onclick={() => (toast = null)}
				aria-label="알림 닫기">×</button
			>
		</div>
	</div>
{/if}
