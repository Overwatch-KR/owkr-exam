<script lang="ts">
	import { untrack } from 'svelte';

	type QuestionType = 'multiple' | 'short' | 'essay';
	type QuestionDraft = {
		id?: string;
		type: string;
		content: string;
		options: string[] | null;
		correctAnswer: number | null;
		points: number;
		updatedAt?: Date;
	};

	let {
		action,
		question = null,
		draft = null,
		submitLabel = '문제 등록'
	}: {
		action: string;
		question?: QuestionDraft | null;
		draft?: QuestionDraft | null;
		submitLabel?: string;
	} = $props();

	const initialQuestion = untrack(() => draft || question);
	let type = $state<QuestionType>((initialQuestion?.type as QuestionType) || 'multiple');
	let content = $state(initialQuestion?.content || '');
	let points = $state(initialQuestion?.points || 1);
	let nextOptionId = 0;
	let optionRows = $state(
		(initialQuestion?.options?.length ? initialQuestion.options : ['', '', '', '']).map(
			(value) => ({
				id: nextOptionId++,
				value
			})
		)
	);
	let correctAnswer = $state(initialQuestion?.correctAnswer ?? 0);

	const types: Array<{ value: QuestionType; label: string; description: string }> = [
		{ value: 'multiple', label: '객관식', description: '보기 중 정답을 선택' },
		{ value: 'short', label: '단답형', description: '짧은 답안을 직접 채점' },
		{ value: 'essay', label: '서술·논술형', description: '긴 답안을 직접 채점' }
	];

	function addOption() {
		optionRows.push({ id: nextOptionId++, value: '' });
	}

	function removeOption(index: number) {
		if (optionRows.length <= 2) return;
		optionRows.splice(index, 1);
		if (correctAnswer === index) correctAnswer = 0;
		else if (correctAnswer > index) correctAnswer -= 1;
	}
</script>

<form method="POST" {action} class="border-ink border-t-2 bg-white px-5 pt-5 pb-6 sm:px-6">
	{#if question?.id}<input type="hidden" name="id" value={question.id} />{/if}
	{#if question?.updatedAt}
		<input type="hidden" name="revision" value={question.updatedAt.toISOString()} />
	{/if}

	<fieldset>
		<legend class="label">문제 유형</legend>
		<div class="grid gap-2 sm:grid-cols-3">
			{#each types as item}
				<label
					class="cursor-pointer border px-4 py-3 transition"
					class:border-[#087ba8]={type === item.value}
					class:bg-[#effbff]={type === item.value}
					class:border-line={type !== item.value}
				>
					<input class="sr-only" type="radio" name="type" value={item.value} bind:group={type} />
					<span class="block text-sm font-bold" class:text-[#087ba8]={type === item.value}
						>{item.label}</span
					>
					<span class="text-muted mt-1 block text-xs">{item.description}</span>
				</label>
			{/each}
		</div>
	</fieldset>

	<div class="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_180px]">
		<div>
			<label class="label" for={`content-${question?.id || 'new'}`}>문제 내용</label>
			<textarea
				id={`content-${question?.id || 'new'}`}
				name="content"
				bind:value={content}
				required
				class="min-h-28 w-full"
				placeholder="응시자에게 보여줄 문제를 입력하세요."></textarea>
		</div>
		<div>
			<label class="label" for={`points-${question?.id || 'new'}`}>배점</label>
			<div class="relative">
				<input
					id={`points-${question?.id || 'new'}`}
					name="points"
					type="number"
					bind:value={points}
					required
					class="w-full pr-9"
				/>
				<span
					class="text-muted pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-semibold"
					>점</span
				>
			</div>
		</div>
	</div>

	{#if type === 'multiple'}
		<fieldset class="border-line mt-5 border-t pt-5">
			<div class="flex items-center justify-between gap-3">
				<div>
					<legend class="text-sm font-bold">보기와 정답</legend>
					<p class="text-muted mt-1 text-xs">왼쪽 원을 눌러 정답을 선택하세요.</p>
				</div>
				<button
					type="button"
					class="text-xs font-bold text-[#087ba8] underline underline-offset-4"
					onclick={addOption}>보기 추가</button
				>
			</div>
			<div class="mt-4 space-y-2">
				{#each optionRows as row, index (row.id)}
					<div class="flex items-center gap-2">
						<label
							class="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border font-mono text-xs font-bold"
							class:border-[#087ba8]={correctAnswer === index}
							class:bg-[#087ba8]={correctAnswer === index}
							class:text-white={correctAnswer === index}
							class:border-line={correctAnswer !== index}
							class:text-muted={correctAnswer !== index}
							aria-label={`${index + 1}번을 정답으로 선택`}
						>
							<input
								class="sr-only"
								type="radio"
								name="correct"
								value={index}
								bind:group={correctAnswer}
							/>
							{index + 1}
						</label>
						<input
							name="option"
							bind:value={row.value}
							required
							class="min-w-0 flex-1"
							placeholder={`${index + 1}번 보기`}
						/>
						<button
							type="button"
							onclick={() => removeOption(index)}
							disabled={optionRows.length <= 2}
							class="text-muted inline-flex h-10 w-10 shrink-0 items-center justify-center hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-30"
							aria-label={`${index + 1}번 보기 삭제`}
						>
							<svg
								viewBox="0 0 20 20"
								class="h-4 w-4"
								fill="none"
								stroke="currentColor"
								stroke-width="1.6"
								aria-hidden="true"
								><path
									d="M4 6h12M8 3h4l1 3H7l1-3Zm-2 3 .7 11h6.6L14 6M8.5 9v5M11.5 9v5"
									stroke-linecap="round"
									stroke-linejoin="round"
								/></svg
							>
						</button>
					</div>
				{/each}
			</div>
		</fieldset>
	{:else}
		<input type="hidden" name="correct" value="0" />
		<p
			class="mt-5 border-l-2 border-[#087ba8] bg-[#effbff] px-3 py-2 text-xs leading-5 text-[#34404d]"
		>
			{type === 'short'
				? '단답형은 응시자가 짧게 작성하며 관리자가 정답·오답으로 채점합니다.'
				: '서술·논술형은 응시자가 길게 작성하며 관리자가 점수를 입력합니다.'}
		</p>
	{/if}

	<button class="btn mt-6 w-full sm:w-auto sm:min-w-36">{submitLabel}</button>
</form>
