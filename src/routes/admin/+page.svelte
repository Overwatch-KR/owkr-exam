<script lang="ts">
		import QuestionEditor from '$lib/components/question-editor.svelte';

		let {data, form} = $props();
		const tab = $derived(data.section);
		let editingQuestion = $state(false);
		const partialScore = (points: number) => Math.max(1, Math.round(points / 2));
		const questionType = (type: string) =>
				type === 'multiple' ? '객관식' : type === 'short' ? '단답형' : '서술·논술형';
</script>

<main class="min-h-screen bg-[#f7f8fa]">
    <header class="site-header">
        <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
            <div>
                <a href="/exam" class="wordmark">OWKR EXAM</a>
                <span class="ml-3 text-xs text-[#6a7684]">시험 관리</span>
            </div>
            <a class="text-xs font-semibold text-[#087ba8] underline underline-offset-4" href="/exam">응시 화면</a>
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
            <a href="/admin/questions" class="shrink-0 border-b-2 px-5 py-3 text-sm font-semibold transition-colors"
               class:border-[#087ba8]={tab==='questions'} class:text-[#087ba8]={tab==='questions'}
               class:border-transparent={tab!=='questions'} aria-current={tab==='questions'?'page':undefined}>문제 관리</a>
            <a href="/admin/codes" class="shrink-0 border-b-2 px-5 py-3 text-sm font-semibold transition-colors"
               class:border-[#087ba8]={tab==='codes'} class:text-[#087ba8]={tab==='codes'}
               class:border-transparent={tab!=='codes'} aria-current={tab==='codes'?'page':undefined}>응시 코드</a>
            <a href="/admin/results" class="shrink-0 border-b-2 px-5 py-3 text-sm font-semibold transition-colors"
               class:border-[#087ba8]={tab==='results'} class:text-[#087ba8]={tab==='results'}
               class:border-transparent={tab!=='results'} aria-current={tab==='results'?'page':undefined}>응시 결과</a>
        </nav>

        {#if form?.message}
            <p class="mt-5 border-l-2 border-red-700 bg-red-50 px-3 py-2 text-sm text-red-800">{form.message}</p>
        {:else if form?.success}
            <p class="mt-5 border-l-2 border-green-700 bg-green-50 px-3 py-2 text-sm text-green-800">{form.success}</p>
        {/if}

		{#if tab === 'questions'}
			<section class="space-y-8 py-8">
				<div>
					<div class="mb-3">
						<h2 class="text-lg font-bold">새 문제 등록</h2>
						<p class="mt-1 text-xs leading-5 text-stone-500">문제 유형을 먼저 고르면 필요한 항목만 표시됩니다. 이미 시험을 시작한 응시자의 문제 사본은 바뀌지 않습니다.</p>
					</div>
					<QuestionEditor action="?/question" />
				</div>

				<div class="min-w-0">
                    {#if data.selectedQuestion}
                        <article id="question-detail" class="mb-8 scroll-mt-5 border-t-2 border-ink bg-white px-5 pb-6 pt-5 sm:px-6">
                            <div class="flex flex-wrap items-center justify-between gap-3">
                                <div class="flex flex-wrap items-center gap-2">
                                    <span class="font-mono text-xs font-bold text-[#087ba8]">문제 {data.selectedQuestion.sortOrder}</span>
                                    <span class="badge">{questionType(data.selectedQuestion.type)}</span>
                                    {#if !data.selectedQuestion.active}<span
                                            class="text-xs font-semibold text-stone-500">비활성</span>{/if}
                                </div>
                                <div class="flex items-center gap-3">
									<button type="button" class="text-xs font-semibold text-[#087ba8] underline underline-offset-4" onclick={() => editingQuestion = !editingQuestion}>{editingQuestion ? '수정 취소' : '문제 수정'}</button>
									<a href="/admin/questions" class="text-xs font-semibold text-[#087ba8] underline underline-offset-4">상세 닫기</a>
								</div>
                            </div>
							<p class="mt-3 text-xs text-muted">마지막 수정 · {data.selectedQuestion.updatedByName || '수정 이력 없음'}{#if data.selectedQuestion.updatedByName} · {data.selectedQuestion.updatedAt.toLocaleString('ko-KR')}{/if}</p>
							{#if editingQuestion}
								<div class="mt-5">
									<QuestionEditor action="?/updateQuestion" question={data.selectedQuestion} submitLabel="수정 내용 저장" />
								</div>
							{:else}
                            <h2 class="mt-5 whitespace-pre-wrap text-lg font-bold leading-8 tracking-[-.02em]">{data.selectedQuestion.content}</h2>
                            <div class="mt-5 grid grid-cols-2 gap-px border border-line bg-line text-sm sm:grid-cols-4">
                                <div class="bg-[#f7f8fa] p-3"><p class="text-[10px] font-semibold text-muted">유형</p>
                                    <p class="mt-1 font-semibold">{questionType(data.selectedQuestion.type)}</p></div>
                                <div class="bg-[#f7f8fa] p-3"><p class="text-[10px] font-semibold text-muted">배점</p>
                                    <p class="mt-1 font-semibold">{data.selectedQuestion.points}점</p></div>
                                <div class="bg-[#f7f8fa] p-3"><p class="text-[10px] font-semibold text-muted">상태</p>
                                    <p class="mt-1 font-semibold">{data.selectedQuestion.active ? '사용 중' : '비활성'}</p>
                                </div>
                                <div class="bg-[#f7f8fa] p-3"><p class="text-[10px] font-semibold text-muted">등록 시각</p>
                                    <p class="mt-1 text-xs font-semibold">{data.selectedQuestion.createdAt.toLocaleString('ko-KR')}</p>
                                </div>
                            </div>
                            {#if data.selectedQuestion.type === 'multiple' && data.selectedQuestion.options?.length}
                                <div class="mt-6">
                                    <p class="text-xs font-bold text-[#34404d]">보기 및 정답</p>
                                    <ol class="mt-3 space-y-2">
                                        {#each data.selectedQuestion.options as option, index}
                                            <li class="flex items-start gap-3 border px-4 py-3 text-sm leading-6"
                                                class:border-[#087ba8]={data.selectedQuestion.correctAnswer === index}
                                                class:bg-[#effbff]={data.selectedQuestion.correctAnswer === index}
                                                class:border-line={data.selectedQuestion.correctAnswer !== index}>
                                                <span
                                                    class="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold"
                                                    class:bg-[#087ba8]={data.selectedQuestion.correctAnswer === index}
                                                    class:text-white={data.selectedQuestion.correctAnswer === index}
                                                    class:text-[#087ba8]={data.selectedQuestion.correctAnswer !== index}>{index + 1}</span>
                                                <span class="flex-1">{option}</span>
                                                {#if data.selectedQuestion.correctAnswer === index}
                                                    <span class="inline-flex shrink-0 items-center gap-1 rounded-sm bg-[#087ba8] px-2 py-1 text-[10px] font-bold leading-none text-white">
                                                        <svg viewBox="0 0 12 12" class="h-3 w-3" fill="none" aria-hidden="true">
                                                            <path d="m2.25 6.1 2.15 2.15 5.35-5.1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
                                                        </svg>
                                                        정답
                                                    </span>
                                                {/if}
                                            </li>
                                        {/each}
                                    </ol>
                                </div>
                            {:else}
                                <p class="mt-5 border-l-2 border-[#087ba8] bg-[#effbff] px-3 py-2 text-xs leading-5 text-[#34404d]">
                                    이 문제는 관리자가 응시자의 답안을 직접 채점합니다.</p>
                            {/if}
							{/if}
                        </article>
                    {/if}
                    <div class="mb-3 flex items-baseline justify-between"><h2 class="text-lg font-bold">등록된 문제</h2><span
                            class="text-xs text-stone-500">총 {data.questions.length}문항</span></div>
                    <div class="overflow-x-auto border-t border-ink">
						<table class="w-full min-w-[820px] table-fixed text-left text-sm">
							<colgroup><col class="w-14" /><col /><col class="w-28" /><col class="w-16" /><col class="w-36" /><col class="w-28" /></colgroup>
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
                            {#each data.questions as q}
                                <tr class="border-b border-line align-top" class:opacity-40={!q.active}>
                                    <td class="p-3 font-mono">{q.sortOrder}</td>
                                    <td class="min-w-0 p-3"><a href={`/admin/questions?question=${q.id}#question-detail`}
                                                                          class="block truncate font-semibold leading-6 text-ink underline decoration-[#b7dce9] underline-offset-4 hover:text-[#087ba8]" title={q.content}>{q.content}</a>
                                        {#if !q.active}<span
                                                class="ml-2 text-[10px] font-semibold text-stone-500">비활성</span>{/if}
                                    </td>
                                    <td class="p-3">{questionType(q.type)}</td>
                                    <td class="p-3">{q.points}</td>
									<td class="p-3"><span class="block truncate text-xs font-semibold" title={q.updatedByName || '수정 이력 없음'}>{q.updatedByName || '수정 이력 없음'}</span>{#if q.updatedByName}<span class="mt-1 block text-[10px] text-muted">{q.updatedAt.toLocaleString('ko-KR')}</span>{/if}</td>
                                    <td class="p-3">
                                        <div class="flex items-center gap-3"><a
                                                href={`/admin/questions?question=${q.id}#question-detail`}
                                                class="text-xs font-bold text-[#087ba8] underline underline-offset-4">상세</a>
                                            <form method="POST" action="?/deleteQuestion"><input type="hidden" name="id"
                                                                                                 value={q.id}/>
                                                <button class="text-xs font-bold text-red-700 underline underline-offset-4">
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
                <form method="POST" action="?/code" class="border-t-2 border-ink pt-4">
                    <h2 class="text-lg font-bold">응시 코드 발급</h2>
                    <p class="mt-1 text-xs leading-5 text-stone-500">특정 Discord 계정에만 사용할 수 있는 1회용 6자리 코드입니다.</p>
                    <label class="label mt-6" for="discordId">Discord User ID</label>
                    <input id="discordId" class="w-full font-mono" name="discordId" placeholder="123456789012345678"
                           required/>
                    <button class="btn mt-5 w-full">코드 발급</button>
                </form>

                <div>
                    <div class="mb-3 flex items-baseline justify-between"><h2 class="text-lg font-bold">발급 이력</h2><span
                            class="text-xs text-stone-500">총 {data.codes.length}건</span></div>
                    <div class="overflow-x-auto border-t border-ink">
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
                            {#each data.codes as c}
                                <tr class="border-b border-line">
                                    <td class="p-3 font-mono font-bold tracking-widest">{c.code}</td>
                                    <td class="p-3 font-mono text-xs">{c.discordId}</td>
                                    <td class="p-3"><span class="badge">{c.status}</span></td>
                                    <td class="p-3 text-xs">{c.createdAt.toLocaleString('ko-KR')}</td>
                                    <td class="p-3">
                                        {#if c.status === 'unused'}
                                            <form method="POST" action="?/expireCode"><input name="id" type="hidden"
                                                                                             value={c.id}/>
                                                <button class="text-xs font-bold text-red-700 underline underline-offset-4">
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
                    <div class="mb-10 border-t-2 border-ink pt-5">
                        <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                            <div>
                                <a href="/admin/results"
                                   class="text-xs font-semibold text-[#087ba8] underline underline-offset-4">← 응시자
                                    목록</a>
                                <h2 class="mt-4 text-2xl font-bold tracking-[-.03em]">{data.grading.attempt.displayName}
                                    답안 채점</h2>
                                <p class="mt-1 font-mono text-xs text-[#6a7684]">{data.grading.attempt.discordId}</p>
                            </div>
                            <div class="grid grid-cols-3 border border-[#c8d0d9] bg-white text-center">
                                <div class="px-4 py-3"><p class="text-[10px] font-semibold text-[#6a7684]">객관식</p>
                                    <p class="mt-1 font-mono font-bold">{data.grading.attempt.objectiveScore}
                                        /{data.grading.objectiveMaxScore}</p></div>
                                <div class="border-x border-[#c8d0d9] px-4 py-3"><p
                                        class="text-[10px] font-semibold text-[#6a7684]">주관식</p>
                                    <p class="mt-1 font-mono font-bold">{data.grading.attempt.subjectiveScore ?? '-'}
                                        /{data.grading.subjectiveMaxScore}</p></div>
                                <div class="px-4 py-3"><p class="text-[10px] font-semibold text-[#6a7684]">총점 · 비공개</p>
                                    <p class="mt-1 font-mono font-bold">{data.grading.attempt.totalScore ?? '-'}</p>
                                </div>
                            </div>
                        </div>
                        <p class="mt-5 border-l-2 border-[#087ba8] bg-[#effbff] px-3 py-2 text-xs leading-5 text-[#34404d]">{data.grading.gradedCount}
                            /{data.grading.questions.length}문항 채점됨 · 모든 주관식 문항의 점수가 입력되면 주관식 점수와 총점이 자동 확정됩니다.</p>

                        <div class="mt-6 space-y-4">
                            {#each data.grading.questions as q, index}
                                <article class="card p-5 sm:p-6">
                                    <div class="flex items-center justify-between gap-3"><p
                                            class="text-xs font-semibold text-[#087ba8]">주관식 {index + 1}
                                        · {q.type === 'short' ? '단답형' : '서술·논술형'}</p>
                                        <p class="text-xs text-[#6a7684]">배점 {q.points}점 · 현재 {q.score ?? '미채점'}</p>
                                    </div>
                                    <h3 class="mt-4 whitespace-pre-wrap text-sm font-semibold leading-6">{q.content}</h3>
                                    <div class="mt-4 min-h-20 whitespace-pre-wrap border border-[#dfe4e9] bg-[#f7f8fa] p-4 text-sm leading-6 text-[#34404d]">{q.answer || '(미응답)'}</div>
                                    {#if q.type === 'short'}
                                        <form method="POST" action="?/grade" class="mt-4 flex flex-wrap gap-2">
                                            <input type="hidden" name="attemptId"
                                                   value={data.grading.attempt.id}/><input type="hidden"
                                                                                           name="questionId"
                                                                                           value={q.id}/>
                                            <button name="score" value={q.points} class="btn-secondary"
                                                    class:border-green-700={q.score===q.points}
                                                    class:text-green-800={q.score===q.points}>정답 · {q.points}점
                                            </button>
                                            <button name="score" value="0" class="btn-secondary"
                                                    class:border-red-700={q.score===0} class:text-red-800={q.score===0}>
                                                오답 · 0점
                                            </button>
                                        </form>
                                    {:else}
                                        <div class="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                            <form method="POST" action="?/grade" class="flex flex-wrap gap-2">
                                                <input type="hidden" name="attemptId"
                                                       value={data.grading.attempt.id}/><input type="hidden"
                                                                                               name="questionId"
                                                                                               value={q.id}/>
                                                <button name="score" value={q.points} class="btn-secondary">만점
                                                    · {q.points}</button>
                                                <button name="score" value={partialScore(q.points)}
                                                        class="btn-secondary">부분 · {partialScore(q.points)}</button>
                                                <button name="score" value="0" class="btn-secondary">미충족 · 0</button>
                                            </form>
                                            <form method="POST" action="?/grade" class="flex items-center gap-2">
                                                <input type="hidden" name="attemptId"
                                                       value={data.grading.attempt.id}/><input type="hidden"
                                                                                               name="questionId"
                                                                                               value={q.id}/>
                                                <label class="text-xs font-semibold" for={`score-${q.id}`}>직접 입력</label><input
                                                    id={`score-${q.id}`} name="score" type="number" min="0"
                                                    max={q.points} value={q.score ?? ''} required class="w-20"/>
                                                <button class="btn-secondary">저장</button>
                                            </form>
                                        </div>
                                    {/if}
                                </article>
                            {/each}
                        </div>
                    </div>
                {/if}

                <div class="mb-3 flex items-baseline justify-between"><h2 class="text-lg font-bold">응시 결과</h2><span
                        class="text-xs text-stone-500">총 {data.attempts.length}명</span></div>
                <div class="overflow-x-auto border-t border-ink">
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
                        {#each data.attempts as a}
                            <tr class="border-b border-line">
                                <td class="p-3 font-semibold">{a.displayName}</td>
                                <td class="p-3 font-mono text-xs">{a.discordId}</td>
                                <td class="p-3"><span
                                        class="badge">{!a.submittedAt ? '응시 중' : a.totalScore === null ? (a.timedOut ? '시간 초과 · 채점 필요' : '채점 필요') : (a.timedOut ? '시간 초과 · 채점 완료' : '채점 완료')}</span>
                                </td>
                                <td class="p-3">{a.submittedAt ? a.objectiveScore : '-'}</td>
                                <td class="p-3">{a.subjectiveScore ?? '-'}</td>
                                <td class="p-3 font-bold">{a.totalScore ?? '-'}</td>
                                <td class="p-3 text-xs">{a.submittedAt ? Math.round((a.submittedAt.getTime() - a.startedAt.getTime()) / 60000) + '분' : '-'}</td>
                                <td class="p-3">
                                    {#if a.submittedAt}<a href={`/admin/results?attempt=${a.id}`}
                                                          class="text-xs font-bold text-[#087ba8] underline underline-offset-4">답안
                                        채점</a>{/if}
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
