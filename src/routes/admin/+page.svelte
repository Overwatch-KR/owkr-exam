<script lang="ts">
	let { data, form } = $props();
	let tab = $state('questions');
	$effect(() => {
		if (data.initialTab === 'results') tab = 'results';
	});
	const partialScore = (points: number) => Math.max(1, Math.round(points / 2));
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

		<nav class="flex overflow-x-auto border-b border-[#c8d0d9]">
			<button class="shrink-0 border-b-2 px-5 py-3 text-sm font-semibold" class:border-[#087ba8]={tab==='questions'} class:text-[#087ba8]={tab==='questions'} class:border-transparent={tab!=='questions'} onclick={()=>tab='questions'}>문제 관리</button>
			<button class="shrink-0 border-b-2 px-5 py-3 text-sm font-semibold" class:border-[#087ba8]={tab==='codes'} class:text-[#087ba8]={tab==='codes'} class:border-transparent={tab!=='codes'} onclick={()=>tab='codes'}>응시 코드</button>
			<button class="shrink-0 border-b-2 px-5 py-3 text-sm font-semibold" class:border-[#087ba8]={tab==='results'} class:text-[#087ba8]={tab==='results'} class:border-transparent={tab!=='results'} onclick={()=>tab='results'}>응시 결과</button>
		</nav>

		{#if form?.message}
			<p class="mt-5 border-l-2 border-red-700 bg-red-50 px-3 py-2 text-sm text-red-800">{form.message}</p>
		{:else if form?.success}
			<p class="mt-5 border-l-2 border-green-700 bg-green-50 px-3 py-2 text-sm text-green-800">{form.success}</p>
		{/if}

		{#if tab === 'questions'}
			<section class="grid gap-10 py-8 lg:grid-cols-[330px_1fr]">
				<form method="POST" action="?/question" class="border-t-2 border-ink pt-4">
					<h2 class="text-lg font-bold">새 문제 등록</h2>
					<p class="mt-1 text-xs leading-5 text-stone-500">등록 뒤 시험을 시작한 응시자에게는 이 문제가 아닌 당시의 문제 사본이 적용됩니다.</p>
					<label class="label mt-6" for="type">문제 유형</label>
					<select id="type" name="type" class="w-full"><option value="multiple">객관식</option><option value="short">단답형</option><option value="essay">서술·논술형</option></select>
					<label class="label mt-4" for="content">문제 내용</label>
					<textarea id="content" name="content" required class="min-h-32 w-full"></textarea>
					<label class="label mt-4" for="options">보기 · 객관식만</label>
					<textarea id="options" name="options" class="min-h-24 w-full" placeholder="보기마다 줄바꿈"></textarea>
					<div class="mt-4 grid grid-cols-2 gap-3">
						<div><label class="label" for="correct">정답 번호</label><input id="correct" name="correct" type="number" min="1" value="1" class="w-full" /></div>
						<div><label class="label" for="points">배점</label><input id="points" name="points" type="number" min="1" value="1" class="w-full" /></div>
					</div>
					<button class="btn mt-5 w-full">문제 등록</button>
				</form>

				<div>
					<div class="mb-3 flex items-baseline justify-between"><h2 class="text-lg font-bold">등록된 문제</h2><span class="text-xs text-stone-500">총 {data.questions.length}문항</span></div>
					<div class="overflow-x-auto border-t border-ink">
						<table class="w-full min-w-[620px] text-left text-sm">
							<thead class="table-head"><tr><th class="p-3">번호</th><th class="p-3">문제</th><th class="p-3">유형</th><th class="p-3">배점</th><th class="p-3"></th></tr></thead>
							<tbody>{#each data.questions as q}<tr class="border-b border-line align-top" class:opacity-40={!q.active}><td class="p-3 font-mono">{q.sortOrder}</td><td class="max-w-md p-3 leading-6">{q.content}{#if !q.active}<span class="ml-2 text-[10px] font-semibold text-stone-500">비활성</span>{/if}</td><td class="p-3">{q.type==='multiple'?'객관식':q.type==='short'?'단답형':'서술·논술형'}</td><td class="p-3">{q.points}</td><td class="p-3"><form method="POST" action="?/deleteQuestion"><input type="hidden" name="id" value={q.id} /><button class="text-xs font-bold text-red-700 underline underline-offset-4">삭제</button></form></td></tr>{/each}</tbody>
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
					<input id="discordId" class="w-full font-mono" name="discordId" placeholder="123456789012345678" required />
					<button class="btn mt-5 w-full">코드 발급</button>
				</form>

				<div>
					<div class="mb-3 flex items-baseline justify-between"><h2 class="text-lg font-bold">발급 이력</h2><span class="text-xs text-stone-500">총 {data.codes.length}건</span></div>
					<div class="overflow-x-auto border-t border-ink">
						<table class="w-full min-w-[650px] text-left text-sm">
							<thead class="table-head"><tr><th class="p-3">코드</th><th class="p-3">대상 Discord ID</th><th class="p-3">상태</th><th class="p-3">발급 시각</th><th class="p-3"></th></tr></thead>
							<tbody>{#each data.codes as c}<tr class="border-b border-line"><td class="p-3 font-mono font-bold tracking-widest">{c.code}</td><td class="p-3 font-mono text-xs">{c.discordId}</td><td class="p-3"><span class="badge">{c.status}</span></td><td class="p-3 text-xs">{c.createdAt.toLocaleString('ko-KR')}</td><td class="p-3">{#if c.status==='unused'}<form method="POST" action="?/expireCode"><input name="id" type="hidden" value={c.id} /><button class="text-xs font-bold text-red-700 underline underline-offset-4">폐기</button></form>{/if}</td></tr>{/each}</tbody>
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
								<a href="/admin?tab=results" class="text-xs font-semibold text-[#087ba8] underline underline-offset-4">← 응시자 목록</a>
								<h2 class="mt-4 text-2xl font-bold tracking-[-.03em]">{data.grading.attempt.displayName} 답안 채점</h2>
								<p class="mt-1 font-mono text-xs text-[#6a7684]">{data.grading.attempt.discordId}</p>
							</div>
							<div class="grid grid-cols-3 border border-[#c8d0d9] bg-white text-center">
								<div class="px-4 py-3"><p class="text-[10px] font-semibold text-[#6a7684]">객관식</p><p class="mt-1 font-mono font-bold">{data.grading.attempt.objectiveScore}/{data.grading.objectiveMaxScore}</p></div>
								<div class="border-x border-[#c8d0d9] px-4 py-3"><p class="text-[10px] font-semibold text-[#6a7684]">주관식</p><p class="mt-1 font-mono font-bold">{data.grading.attempt.subjectiveScore ?? '-'}/{data.grading.subjectiveMaxScore}</p></div>
								<div class="px-4 py-3"><p class="text-[10px] font-semibold text-[#6a7684]">총점 · 비공개</p><p class="mt-1 font-mono font-bold">{data.grading.attempt.totalScore ?? '-'}</p></div>
							</div>
						</div>
						<p class="mt-5 border-l-2 border-[#087ba8] bg-[#effbff] px-3 py-2 text-xs leading-5 text-[#34404d]">{data.grading.gradedCount}/{data.grading.questions.length}문항 채점됨 · 모든 주관식 문항의 점수가 입력되면 주관식 점수와 총점이 자동 확정됩니다.</p>

						<div class="mt-6 space-y-4">
							{#each data.grading.questions as q, index}
								<article class="card p-5 sm:p-6">
									<div class="flex items-center justify-between gap-3"><p class="text-xs font-semibold text-[#087ba8]">주관식 {index+1} · {q.type==='short'?'단답형':'서술·논술형'}</p><p class="text-xs text-[#6a7684]">배점 {q.points}점 · 현재 {q.score ?? '미채점'}</p></div>
									<h3 class="mt-4 whitespace-pre-wrap text-sm font-semibold leading-6">{q.content}</h3>
									<div class="mt-4 min-h-20 whitespace-pre-wrap border border-[#dfe4e9] bg-[#f7f8fa] p-4 text-sm leading-6 text-[#34404d]">{q.answer || '(미응답)'}</div>
									{#if q.type === 'short'}
										<form method="POST" action="?/grade" class="mt-4 flex flex-wrap gap-2">
											<input type="hidden" name="attemptId" value={data.grading.attempt.id} /><input type="hidden" name="questionId" value={q.id} />
											<button name="score" value={q.points} class="btn-secondary" class:border-green-700={q.score===q.points} class:text-green-800={q.score===q.points}>정답 · {q.points}점</button>
											<button name="score" value="0" class="btn-secondary" class:border-red-700={q.score===0} class:text-red-800={q.score===0}>오답 · 0점</button>
										</form>
									{:else}
										<div class="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
											<form method="POST" action="?/grade" class="flex flex-wrap gap-2">
												<input type="hidden" name="attemptId" value={data.grading.attempt.id} /><input type="hidden" name="questionId" value={q.id} />
												<button name="score" value={q.points} class="btn-secondary">만점 · {q.points}</button>
												<button name="score" value={partialScore(q.points)} class="btn-secondary">부분 · {partialScore(q.points)}</button>
												<button name="score" value="0" class="btn-secondary">미충족 · 0</button>
											</form>
											<form method="POST" action="?/grade" class="flex items-center gap-2">
												<input type="hidden" name="attemptId" value={data.grading.attempt.id} /><input type="hidden" name="questionId" value={q.id} />
												<label class="text-xs font-semibold" for={`score-${q.id}`}>직접 입력</label><input id={`score-${q.id}`} name="score" type="number" min="0" max={q.points} value={q.score ?? ''} required class="w-20" /><button class="btn-secondary">저장</button>
											</form>
										</div>
									{/if}
								</article>
							{/each}
						</div>
					</div>
				{/if}

				<div class="mb-3 flex items-baseline justify-between"><h2 class="text-lg font-bold">응시 결과</h2><span class="text-xs text-stone-500">총 {data.attempts.length}명</span></div>
				<div class="overflow-x-auto border-t border-ink">
					<table class="w-full min-w-[850px] text-left text-sm">
						<thead class="table-head"><tr><th class="p-3">지원자</th><th class="p-3">Discord ID</th><th class="p-3">상태</th><th class="p-3">객관식</th><th class="p-3">주관식</th><th class="p-3">총점</th><th class="p-3">응시 시간</th><th class="p-3"></th></tr></thead>
						<tbody>{#each data.attempts as a}<tr class="border-b border-line"><td class="p-3 font-semibold">{a.displayName}</td><td class="p-3 font-mono text-xs">{a.discordId}</td><td class="p-3"><span class="badge">{!a.submittedAt?'응시 중':a.totalScore===null?(a.timedOut?'시간 초과 · 채점 필요':'채점 필요'):(a.timedOut?'시간 초과 · 채점 완료':'채점 완료')}</span></td><td class="p-3">{a.submittedAt?a.objectiveScore:'-'}</td><td class="p-3">{a.subjectiveScore??'-'}</td><td class="p-3 font-bold">{a.totalScore??'-'}</td><td class="p-3 text-xs">{a.submittedAt?Math.round((a.submittedAt.getTime()-a.startedAt.getTime())/60000)+'분':'-'}</td><td class="p-3">{#if a.submittedAt}<a href={`/admin?tab=results&attempt=${a.id}`} class="text-xs font-bold text-[#087ba8] underline underline-offset-4">답안 채점</a>{/if}</td></tr>{/each}</tbody>
					</table>
				</div>
			</section>
		{/if}
	</div>
</main>
