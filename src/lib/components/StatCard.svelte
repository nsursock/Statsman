<script lang="ts">
	import { countUp } from '@scifiui/core/js';

	let {
		label,
		value,
		suffix = ''
	}: {
		label: string;
		value: number | string;
		suffix?: string;
	} = $props();

	let display = $state('0');

	$effect(() => {
		if (typeof value === 'string') {
			display = value;
			return;
		}
		const target = value;
		const scale = target % 1 === 0 ? 1 : 10;
		const targets = { n: Math.round(target * scale) };
		const tween = countUp(targets, (vals) => {
			const n = vals.n / scale;
			display =
				target % 1 === 0 ? Math.round(n).toLocaleString() : n.toFixed(1);
		});
		return () => {
			if (tween && typeof (tween as { kill?: () => void }).kill === 'function') {
				(tween as { kill: () => void }).kill();
			}
		};
	});
</script>

<div class="metric-card" data-enter>
	<div class="card-head">
		<div class="card-label"><span class="label-bar"></span> {label}</div>
	</div>
	<div class="card-value">{display}{suffix}</div>
</div>
