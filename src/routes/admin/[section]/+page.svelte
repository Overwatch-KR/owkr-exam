<script lang="ts">
	import AdminPage from '../+page.svelte';

	let { data, form } = $props();
</script>

<AdminPage {data} {form} />
